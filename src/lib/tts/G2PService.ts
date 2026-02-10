import G2PWorker from '../../workers/g2p.worker?worker';

/**
 * G2PService
 * Singleton that manages the phonemization worker.
 */
class G2PService {
    private worker: Worker | null = null;
    private pendingRequests = new Map<string, (value: string) => void>();

    async init(): Promise<void> {
        if (this.worker) return;

        this.worker = new G2PWorker();
        this.worker.onmessage = (e) => {
            const { id, phonemes, type } = e.data;
            if (type === 'READY') return;
            
            const resolve = this.pendingRequests.get(id);
            if (resolve) {
                resolve(phonemes);
                this.pendingRequests.delete(id);
            }
        };
    }

    async phonemize(text: string, lang: string = 'en-us'): Promise<string> {
        if (!this.worker) await this.init();
        
        return new Promise((resolve) => {
            const id = Math.random().toString(36).substring(7);
            this.pendingRequests.set(id, resolve);
            this.worker!.postMessage({ id, text, lang });
        });
    }
}

export const g2pService = new G2PService();