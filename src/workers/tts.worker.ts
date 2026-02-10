import * as Comlink from 'comlink';
import { AudioEncoderService } from '../lib/audio-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../types/tts';
import { file } from 'opfs-tools';

/**
 * TTSWorker Implementation
 * Uses native WebCodecs for high-performance encoding.
 * Uses opfs-tools for unified file system access.
 */
class TTSWorkerImpl {
    private currentEngine: any = null;
    private currentModelId: string | null = null;

    public async initModel(
        modelId: string, 
        _unusedRoot: any, // Kept for interface compatibility but ignored
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
                // Dynamic imports ensure we don't bundle engines we don't use
                const { KokoroEngine } = await import('../lib/tts/KokoroEngine');
                EngineClass = KokoroEngine;
                break;
            case 'kitten':
                const { KittenEngine } = await import('../lib/tts/KittenEngine');
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
    ): Promise<{ byteSize: number, blob?: Blob }> {
        
        if (!this.currentEngine) throw new Error("Engine not initialized");

        // 1. Inference
        const result = await this.currentEngine.generate(text, config);
        
        // 2. Encoding (Float32 -> Opus/WAV)
        const audioBlob = await AudioEncoderService.encode(result.audio, result.sampleRate);

        // 3. Storage (Direct to OPFS via opfs-tools)
        try {
            await file(filepath).write(audioBlob);
            return { byteSize: audioBlob.size };
        } catch (storageErr) {
            console.error("Worker OPFS Write Failed:", storageErr);
            // Fallback: return blob to main thread to handle
            return { byteSize: audioBlob.size, blob: audioBlob };
        }
    }
}

Comlink.expose(new TTSWorkerImpl());