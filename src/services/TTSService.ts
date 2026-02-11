import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig } from '../types/tts';
import { storage } from './storage';

interface TTSWorkerApi {
    initModel(
        modelId: string, 
        rootHandle: undefined, 
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
  // Local status tracker for Worker environments where Zustand doesn't sync with UI
  private localStatus: ModelStatus = ModelStatus.UNLOADED;
  private isUIContext: boolean;

  constructor() {
    this.isUIContext = typeof window !== 'undefined' && typeof document !== 'undefined';
    console.log(`[TTSService] Instantiated (Context: ${this.isUIContext ? 'UI' : 'WORKER'})`);
  }

  private async getWorker() {
    if (!this.worker) {
        const rawWorker = new TTSWorker();
        this.worker = Comlink.wrap<TTSWorkerApi>(rawWorker);
    }
    return this.worker;
  }

  public async loadModel(modelId: string) {
    // Only update UI store if we are in the UI context
    if (this.isUIContext) {
        const store = useTTSStore.getState();
        store.setStatus(ModelStatus.LOADING);
        store.setThinking('Initializing Worker...', 0);
    }
    this.localStatus = ModelStatus.LOADING;

    try {
        const worker = await this.getWorker();

        // Pass proxy for callbacks
        const result = await worker.initModel(
            modelId, 
            undefined, 
            Comlink.proxy((phase, percent) => {
                if (this.isUIContext) {
                    useTTSStore.getState().setThinking(phase, percent);
                }
            })
        );

        console.log(`[TTSService] Model ${result.modelId} ready.`);
        
        this.localStatus = ModelStatus.READY;
        if (this.isUIContext) {
            const store = useTTSStore.getState();
            store.setStatus(ModelStatus.READY);
            store.setVoices(result.voices);
        }

    } catch (e: any) {
        console.error("[TTSService] Init Failed", e);
        this.localStatus = ModelStatus.ERROR;
        if (this.isUIContext) {
            useTTSStore.getState().setStatus(ModelStatus.ERROR, e.message || String(e));
        }
    }
  }

  public async generate(text: string, config: ModelConfig, filepath: string): Promise<number> {
    // Check local status (works in both UI and Worker)
    if (this.localStatus !== ModelStatus.READY) {
         // If we are in the UI, we might trust the store, but localStatus is safer
         const storeStatus = this.isUIContext ? useTTSStore.getState().modelStatus : ModelStatus.UNLOADED;
         
         if (this.localStatus !== ModelStatus.READY && storeStatus !== ModelStatus.READY) {
            throw new Error(`Model is not loaded (Status: ${this.localStatus}).`);
         }
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