import TTSWorker from '../workers/tts.worker?worker';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus, type ModelConfig } from '../types/tts';
import { storage } from './storage';

interface QueuedRequest {
  text: string;
  config: ModelConfig;
  filepath: string;
  resolve: (size: number) => void;
  reject: (e: any) => void;
}

class TTSService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (size: number) => void; reject: (e: string) => void; filepath: string }>();
  private requestQueue: QueuedRequest[] = [];

  constructor() {
    console.log("[TTSService] Instantiated");
  }

  init() {
    if (this.worker) return;

    try {
        this.worker = new TTSWorker();
        
        this.worker.onerror = (e: ErrorEvent) => {
            const errorMsg = e.message || "Unknown Worker Error";
            useTTSStore.getState().setStatus(ModelStatus.ERROR, `Worker Crash: ${errorMsg}`);
        };

        this.worker.onmessage = async (event: MessageEvent<any>) => {
          const msg = event.data;
          const store = useTTSStore.getState();

          switch (msg.type) {
            case 'PROGRESS':
              store.setThinking(msg.payload.phase, msg.payload.percent);
              break;
            
            case 'INIT_SUCCESS':
              console.log(`[TTSService] Model ${msg.payload.modelId} ready.`);
              store.setStatus(ModelStatus.READY);
              if (msg.payload.voices) {
                store.setVoices(msg.payload.voices);
              }
              this.processQueue();
              break;

            case 'INIT_ERROR':
              store.setStatus(ModelStatus.ERROR, msg.error);
              this.rejectQueue(msg.error);
              break;

            case 'GENERATION_COMPLETE':
              if (this.pendingRequests.has(msg.payload.id)) {
                const { resolve, filepath } = this.pendingRequests.get(msg.payload.id)!;
                
                // EPIC 4: Worker Centric Storage
                // If the worker returns a blob, it means OPFS wasn't available inside the worker,
                // so we fallback to Main Thread writing.
                // Otherwise, we assume the worker wrote it successfully.
                if (msg.payload.blob) {
                    await storage.saveFile(filepath, msg.payload.blob);
                }
                
                resolve(msg.payload.byteSize);
                this.pendingRequests.delete(msg.payload.id);
              }
              break;

            case 'GENERATION_ERROR':
              if (this.pendingRequests.has(msg.payload.id)) {
                const { reject } = this.pendingRequests.get(msg.payload.id)!;
                reject(msg.payload.error);
                this.pendingRequests.delete(msg.payload.id);
              }
              break;
          }
        };
    } catch (err) {
        useTTSStore.getState().setStatus(ModelStatus.ERROR, "Worker creation failed");
    }
  }

  public async loadModel(modelId: string) {
    if (!this.worker) this.init();
    
    useTTSStore.getState().setStatus(ModelStatus.LOADING);
    useTTSStore.getState().setThinking('Initializing...', 0);

    let rootHandle: FileSystemDirectoryHandle | undefined = undefined;
    try {
        // EPIC 4: Grab the raw handle to pass to worker
        const handle = await storage.getRootHandle();
        if (handle) rootHandle = handle;
    } catch (e) { /* ignore */ }
    
    this.worker?.postMessage({ 
        type: 'INIT_MODEL', 
        payload: { modelId, rootHandle } 
    });
  }

  public generate(text: string, config: ModelConfig, filepath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const store = useTTSStore.getState();
        if (store.modelStatus === ModelStatus.LOADING) {
            this.requestQueue.push({ text, config, filepath, resolve, reject });
            return;
        }
        if (store.modelStatus !== ModelStatus.READY) {
            reject(`Model status is ${store.modelStatus}`);
            return;
        }
        this.sendGenerateRequest(text, config, filepath, resolve, reject);
    });
  }

  private sendGenerateRequest(text: string, config: ModelConfig, filepath: string, resolve: any, reject: any) {
      if (!this.worker) return reject('No worker');
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, { resolve, reject, filepath });
      this.worker.postMessage({
          type: 'GENERATE',
          payload: { id, text, config, filepath }
      });
  }

  private processQueue() {
      const q = [...this.requestQueue];
      this.requestQueue = [];
      q.forEach(req => this.sendGenerateRequest(req.text, req.config, req.filepath, req.resolve, req.reject));
  }

  private rejectQueue(error: string) {
      const q = [...this.requestQueue];
      this.requestQueue = [];
      q.forEach(req => req.reject(error));
  }
}

export const ttsService = new TTSService();