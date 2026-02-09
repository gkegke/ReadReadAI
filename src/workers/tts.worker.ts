import * as Comlink from 'comlink';
import { AudioEncoderService } from '../lib/audio-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../types/tts';
import { writeToHandle } from '../lib/storage-shared';

/**
 * TTSWorker Implementation
 * Uses native WebCodecs for high-performance encoding.
 */
class TTSWorkerImpl {
    private currentEngine: any = null;
    private currentModelId: string | null = null;
    private opfsRoot: FileSystemDirectoryHandle | null = null;

    public async initModel(
        modelId: string, 
        rootHandle: FileSystemDirectoryHandle | undefined,
        onProgress: (phase: string, percent: number) => void
    ): Promise<{ modelId: string, voices: {id: string, name: string}[] }> {
        
        if (this.currentModelId === modelId && this.currentEngine) {
            return { modelId, voices: this.currentEngine.getVoices() };
        }

        if (rootHandle) this.opfsRoot = rootHandle;

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
        return { modelId, voices };
    }

    public async generate(
        text: string, 
        config: ModelConfig, 
        filepath: string
    ): Promise<{ byteSize: number, blob?: Blob }> {
        
        if (!this.currentEngine) throw new Error("Engine not initialized");

        const result = await this.currentEngine.generate(text, config);
        
        // PIVOT: Using WebCodecs native encoder
        const audioBlob = await AudioEncoderService.encode(result.audio, result.sampleRate);

        if (this.opfsRoot) {
            try {
                await writeToHandle(this.opfsRoot, filepath, audioBlob);
                return { byteSize: audioBlob.size };
            } catch (storageErr) {
                return { byteSize: audioBlob.size, blob: audioBlob };
            }
        } else {
            return { byteSize: audioBlob.size, blob: audioBlob };
        }
    }
}

Comlink.expose(new TTSWorkerImpl());