import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig } from '../types/tts';
import { storage } from './storage';

// Define the interface of the Worker for TypeScript
// Note: We duplicate the signature here or export it from the worker file
interface TTSWorkerApi {
    initModel(
        modelId: string, 
        rootHandle: FileSystemDirectoryHandle | undefined,
        onProgress: (phase: string, percent: number) => void
    ): Promise<{ modelId: string, voices: {id: string, name: string}[] }>;
    
    generate(
        text: string, 
        config: ModelConfig, 
        filepath: string
    ): Promise<{ byteSize: number, blob?: Blob }>;
}

class TTSService {
  private worker: Comlink.Remote<TTSWorkerApi> | null = null;

  constructor() {
    console.log("[TTSService] Instantiated (Comlink)");
  }

  private async getWorker() {
    if (!this.worker) {
        const rawWorker = new TTSWorker();
        this.worker = Comlink.wrap<TTSWorkerApi>(rawWorker);
    }
    return this.worker;
  }

  public async loadModel(modelId: string) {
    const store = useTTSStore.getState();
    store.setStatus(ModelStatus.LOADING);
    store.setThinking('Initializing Worker...', 0);

    try {
        let rootHandle: FileSystemDirectoryHandle | undefined = undefined;
        try {
            // Get raw handle for OPFS to pass to worker
            const handle = await storage.getRootHandle();
            if (handle) rootHandle = handle;
        } catch (e) { /* ignore */ }

        const worker = await this.getWorker();

        // Use Comlink.proxy to pass the callback function
        const result = await worker.initModel(
            modelId, 
            rootHandle,
            Comlink.proxy((phase, percent) => {
                store.setThinking(phase, percent);
            })
        );

        console.log(`[TTSService] Model ${result.modelId} ready.`);
        store.setStatus(ModelStatus.READY);
        store.setVoices(result.voices);

    } catch (e: any) {
        console.error("[TTSService] Init Failed", e);
        store.setStatus(ModelStatus.ERROR, e.message || String(e));
    }
  }

  public async generate(text: string, config: ModelConfig, filepath: string): Promise<number> {
    const store = useTTSStore.getState();
    
    if (store.modelStatus !== ModelStatus.READY) {
        // Auto-load if unloaded
        if (store.modelStatus === ModelStatus.UNLOADED) {
            // This is a bit risky with async, but for MVP it's okay. 
            // Ideally explicit load is better.
             throw new Error("Model is not loaded. Please wait for initialization.");
        }
        throw new Error(`Model status is ${store.modelStatus}`);
    }

    const worker = await this.getWorker();
    
    try {
        const result = await worker.generate(text, config, filepath);
        
        // Handle fallback if Worker couldn't write to OPFS directly
        if (result.blob) {
            await storage.saveFile(filepath, result.blob);
        }
        
        return result.byteSize;
    } catch (e) {
        console.error("Generation Error", e);
        throw e;
    }
  }
}

export const ttsService = new TTSService();