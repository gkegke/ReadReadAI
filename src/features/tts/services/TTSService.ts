import * as Comlink from 'comlink';
import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { ModelStatus, type ModelConfig, type TTSWorkerApi } from '../../../shared/types/tts';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';
import { WorkerFactory } from '../../../shared/lib/worker-factory';

class TTSService {
  private factory = new WorkerFactory<TTSWorkerApi>(TTSWorker, 'TTS-Core');
  private localStatus: ModelStatus = ModelStatus.UNLOADED;
  private isUIContext: boolean = typeof window !== 'undefined';

  public async loadModel(modelId: string) {
    // [EPIC 1] Removed proactive hardware check + auto-downgrade. 
    // We now respect the user's explicit choice from the BootScreen.

    if (this.localStatus !== ModelStatus.UNLOADED) {
        this.factory.recreate();
    }

    if (this.isUIContext) useTTSStore.getState().setStatus(ModelStatus.LOADING);
    this.localStatus = ModelStatus.LOADING;

    try {
        const worker = await this.factory.getInstance();
        const result = await worker.initModel(modelId, undefined, Comlink.proxy((phase, percent) => {
            if (this.isUIContext) useTTSStore.getState().setThinking(phase, percent);
        }));

        this.localStatus = ModelStatus.READY;
        if (this.isUIContext) {
            const store = useTTSStore.getState();
            store.setStatus(ModelStatus.READY);
            store.setVoices(result.voices);
            useSystemStore.getState().setActiveModelId(modelId);
        }
    } catch (e: any) {
        this.localStatus = ModelStatus.ERROR;
        if (this.isUIContext) useTTSStore.getState().setStatus(ModelStatus.ERROR, e.message);
        logger.error('TTS', 'Model load failed.', e);
    }
  }

  public async generate(text: string, config: ModelConfig, filepath: string): Promise<number> {
    const worker = await this.factory.getInstance();
    try {
        const result = await worker.generate(text, config, filepath);
        if (result.blob) await storage.saveFile(filepath, result.blob);
        return result.byteSize;
    } catch (e) {
        logger.error('TTS', 'Generation failed', e);
        throw e;
    }
  }
}

export const ttsService = new TTSService();