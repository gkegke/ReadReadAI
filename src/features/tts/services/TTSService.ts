import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig, type TTSWorkerApi } from '../../../shared/types/tts';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';
import { WorkerFactory } from '../../../shared/lib/worker-factory'; // NEW

class TTSService {
  // NEW: Use the robust factory
  private factory = new WorkerFactory<TTSWorkerApi>(TTSWorker, 'TTS-Core');
  private localStatus: ModelStatus = ModelStatus.UNLOADED;
  private isUIContext: boolean = typeof window !== 'undefined';

  public async loadModel(modelId: string) {
    const markName = `model-load-${modelId}`;
    performance.mark(markName);
    
    if (this.isUIContext) {
        useTTSStore.getState().setStatus(ModelStatus.LOADING);
    }
    this.localStatus = ModelStatus.LOADING;

    try {
        // NEW: specific type usage via factory
        const worker = await this.factory.getInstance();
        
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

    const worker = await this.factory.getInstance();
    try {
        const result = await worker.generate(text, config, filepath);
        // Note: With OPFS, the worker writes directly. Blob is legacy fallback.
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