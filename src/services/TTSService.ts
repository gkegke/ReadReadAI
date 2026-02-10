import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig } from '../types/tts';
import { storage } from './storage';

interface TTSWorkerApi {
    initModel(
        modelId: string, 
        rootHandle: undefined, // deprecated arg
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
    console.log("[TTSService] Instantiated");
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
        const worker = await this.getWorker();

        // Pass proxy for callbacks
        const result = await worker.initModel(
            modelId, 
            undefined, // Worker uses opfs-tools now
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
         throw new Error("Model is not loaded. Please wait for initialization.");
    }

    const worker = await this.getWorker();
    
    try {
        const result = await worker.generate(text, config, filepath);
        
        // Fallback if worker failed to write (e.g., Firefox Private Mode)
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