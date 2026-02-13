import * as Comlink from 'comlink';
import { AudioEncoderService } from '../../../shared/lib/audio-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../../../shared/types/tts';

class TTSWorkerImpl {
    private currentEngine: any = null;
    private currentModelId: string | null = null;

    /**
     * CRITICAL: Peak Calculation
     * Performed in the worker to allow the UI to render the WaveformCanvas 
     * without ever needing to touch the raw AudioBuffer on the main thread.
     */
    private calculatePeaks(samples: Float32Array, numPeaks: number = 100): number[] {
        const step = Math.floor(samples.length / numPeaks);
        const peaks: number[] = [];
        
        for (let i = 0; i < numPeaks; i++) {
            let max = 0;
            const start = i * step;
            // Sample the window
            for (let j = 0; j < step; j++) {
                const val = Math.abs(samples[start + j]);
                if (val > max) max = val;
            }
            peaks.push(Number(max.toFixed(3))); // Precision sufficient for rendering
        }
        return peaks;
    }

    public async initModel(
        modelId: string, 
        _unused: any,
        onProgress: (phase: string, percent: number) => void
    ): Promise<{ modelId: string, voices: {id: string, name: string}[] }> {
        if (this.currentModelId === modelId && this.currentEngine) {
            return { modelId, voices: this.currentEngine.getVoices() };
        }

        const modelDef = AVAILABLE_MODELS.find(m => m.id === modelId);
        if (!modelDef) throw new Error(`Model ${modelId} not found`);

        onProgress(`Loading ${modelDef.name}...`, 10);

        let EngineClass;
        switch (modelDef.provider) {
            case 'kokoro':
                const { KokoroEngine } = await import('../lib/KokoroEngine');
                EngineClass = KokoroEngine;
                break;
            case 'kitten':
                const { KittenEngine } = await import('../lib/KittenEngine');
                EngineClass = KittenEngine;
                break;
            default:
                throw new Error("Unknown Provider");
        }

        this.currentEngine = new EngineClass();
        await this.currentEngine.init(modelDef.config);

        this.currentModelId = modelId;
        const voices = this.currentEngine.getVoices();
        
        onProgress('Ready', 100);
        return { modelId, voices };
    }

    public async generate(
        text: string, 
        config: ModelConfig, 
        filepath: string
    ): Promise<{ byteSize: number, peaks: number[], blob?: Blob }> {
        
        if (!this.currentEngine) throw new Error("Engine not initialized");

        // 1. AI Inference (Heavy CPU/GPU)
        const result = await this.currentEngine.generate(text, config);
        
        // 2. Encoding (OPUS/WAV)
        const audioBlob = await AudioEncoderService.encode(result.audio, result.sampleRate);

        // 3. Peak Calculation (New: Offloaded from UI)
        const peaks = this.calculatePeaks(result.audio, 120);

        // 4. Persistence (OPFS)
        try {
            const root = await navigator.storage.getDirectory();
            const parts = filepath.split('/');
            const fileName = parts.pop()!;
            let currentDir = root;

            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }

            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(audioBlob);
            await writable.close();

            return { byteSize: audioBlob.size, peaks };
        } catch (err) {
            // Fallback for non-OPFS environments
            return { byteSize: audioBlob.size, peaks, blob: audioBlob };
        }
    }
}

Comlink.expose(new TTSWorkerImpl());