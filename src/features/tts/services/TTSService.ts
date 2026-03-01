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

  /**
   * [EPIC 5] Proactive Hardware Profiling
   * Prevents attempting high-memory models on underpowered devices.
   */
  private checkHardwareCapability(modelId: string): boolean {
    if (modelId === 'kitten-v0-q8' || modelId === 'debug-sine') return true;
    
    // deviceMemory is in GB. If < 4GB, Kokoro is risky.
    const mem = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    
    if (mem && mem < 4) {
      logger.warn('TTSService', `Device memory (${mem}GB) is low. Proactively suggesting nano model.`);
      return false;
    }
    if (cores && cores < 4) {
      logger.warn('TTSService', `Low CPU core count (${cores}). Kokoro might be too slow.`);
      return false;
    }
    return true;
  }

  public async loadModel(modelId: string) {
    // Proactive Downgrade
    if (!this.checkHardwareCapability(modelId)) {
        logger.info('TTSService', 'Redirecting to performance model due to hardware profile.');
        return this.loadModel('kitten-v0-q8');
    }

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
        // [EPIC 5] Reactive Fallback
        if (modelId !== 'kitten-v0-q8' && modelId !== 'debug-sine') {
            logger.warn('TTS', 'Model load failed. Auto-downgrading.');
            return this.loadModel('kitten-v0-q8');
        }
        this.localStatus = ModelStatus.ERROR;
        if (this.isUIContext) useTTSStore.getState().setStatus(ModelStatus.ERROR, e.message);
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