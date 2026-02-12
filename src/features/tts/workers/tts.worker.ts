import * as Comlink from 'comlink';
import { AudioEncoderService } from '../../../shared/lib/audio-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../../../shared/types/tts';

class TTSWorkerImpl {
    private currentEngine: any = null;
    private currentModelId: string | null = null;

    /**
     * Downsamples audio buffer into normalized peaks for canvas rendering.
     * Calculated in the worker to save UI thread cycles.
     */
    private calculatePeaks(samples: Float32Array, numPeaks: number = 100): number[] {
        const step = Math.floor(samples.length / numPeaks);
        const peaks: number[] = [];
        
        for (let i = 0; i < numPeaks; i++) {
            let max = 0;
            const start = i * step;
            for (let j = 0; j < step; j++) {
                const val = Math.abs(samples[start + j]);
                if (val > max) max = val;
            }
            peaks.push(max);
        }
        return peaks;
    }

    public async initModel(
        modelId: string, 
        _unusedRoot: any,
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
                EngineClass = null;
        }

        if (EngineClass) {
            this.currentEngine = new EngineClass();
            await this.currentEngine.init(modelDef.config);
        }

        this.currentModelId = modelId;
        const voices = this.currentEngine ? this.currentEngine.getVoices() : [];
        
        onProgress('Ready', 100);
        return { modelId, voices };
    }

    public async generate(
        text: string, 
        config: ModelConfig, 
        filepath: string
    ): Promise<{ byteSize: number, peaks: number[], blob?: Blob }> {
        
        if (!this.currentEngine) throw new Error("Engine not initialized");

        // 1. Inference
        const result = await this.currentEngine.generate(text, config);
        
        // 2. Encoding
        const audioBlob = await AudioEncoderService.encode(result.audio, result.sampleRate);

        // 3. Peak Calculation (New)
        const peaks = this.calculatePeaks(result.audio, 150);

        // 4. Native Storage Write
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
        } catch (storageErr) {
            console.error("[Worker] Native OPFS Write Failed", storageErr);
            return { byteSize: audioBlob.size, peaks, blob: audioBlob };
        }
    }
}

Comlink.expose(new TTSWorkerImpl());