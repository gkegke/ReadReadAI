import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig } from '../../../shared/types/tts';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';

interface TTSWorkerApi {
    initModel(modelId: string, rootHandle: undefined, onProgress: (phase: string, percent: number) => void): Promise<any>;
    generate(text: string, config: ModelConfig, filepath: string): Promise<any>;
}

class TTSService {
  private worker: Comlink.Remote<TTSWorkerApi> | null = null;
  private localStatus: ModelStatus = ModelStatus.UNLOADED;
  private isUIContext: boolean = typeof window !== 'undefined';

  private async getWorker() {
    if (!this.worker) {
        this.worker = Comlink.wrap<TTSWorkerApi>(new TTSWorker());
    }
    return this.worker;
  }

  public async loadModel(modelId: string) {
    const markName = `model-load-${modelId}`;
    performance.mark(markName); // LOGGING: Start performance tracking
    
    if (this.isUIContext) {
        useTTSStore.getState().setStatus(ModelStatus.LOADING);
    }
    this.localStatus = ModelStatus.LOADING;

    try {
        const worker = await this.getWorker();
        const result = await worker.initModel(modelId, undefined, Comlink.proxy((phase, percent) => {
            if (this.isUIContext) useTTSStore.getState().setThinking(phase, percent);
        }));

        this.localStatus = ModelStatus.READY;
        if (this.isUIContext) {
            const store = useTTSStore.getState();
            store.setStatus(ModelStatus.READY);
            store.setVoices(result.voices);
        }
        
        performance.measure(`Model Load: ${modelId}`, markName);
        logger.info('TTS', `Model ${modelId} loaded successfully`);
    } catch (e: any) {
        this.localStatus = ModelStatus.ERROR;
        if (this.isUIContext) useTTSStore.getState().setStatus(ModelStatus.ERROR, e.message);
        logger.error('TTS', 'Model load failed', e);
    }
  }

  public async generate(text: string, config: ModelConfig, filepath: string): Promise<number> {
    const markName = `gen-${Math.random()}`;
    performance.mark(markName);

    const worker = await this.getWorker();
    try {
        const result = await worker.generate(text, config, filepath);
        if (result.blob) await storage.saveFile(filepath, result.blob);
        
        performance.measure(`Inference: ${text.slice(0, 20)}...`, markName);
        return result.byteSize;
    } catch (e) {
        logger.error('TTS', 'Generation failed', e);
        throw e;
    }
  }
}

export const ttsService = new TTSService();