import * as Comlink from 'comlink';
import { AudioEncoderService } from '../lib/audio-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../types/tts';

/**
 * TTSWorker Implementation
 * Uses native Web APIs for storage and encoding.
 */
class TTSWorkerImpl {
    private currentEngine: any = null;
    private currentModelId: string | null = null;

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
        
        // 2. Encoding
        const audioBlob = await AudioEncoderService.encode(result.audio, result.sampleRate);

        // 3. Native Storage Write
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

            return { byteSize: audioBlob.size };
        } catch (storageErr) {
            console.error("[Worker] Native OPFS Write Failed, falling back to message passing", storageErr);
            return { byteSize: audioBlob.size, blob: audioBlob };
        }
    }
}

Comlink.expose(new TTSWorkerImpl());