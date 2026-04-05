import G2PWorker from '../workers/g2p.worker?worker';
import { WorkerFactory } from '../../../shared/lib/worker-factory';

interface G2PWorkerApi {
    phonemize(text: string, lang?: string): Promise<string>;
}

/**
 * G2PService
 * Uses WorkerFactory for consistent lifecycle and error recovery.
 */
class G2PService {
    private factory = new WorkerFactory<G2PWorkerApi>(G2PWorker, 'G2P-Phonemizer');

    async init(): Promise<void> {
        await this.factory.getInstance();
    }

    async phonemize(text: string, lang: string = 'en-us'): Promise<string> {
        const worker = await this.factory.getInstance();
        return await worker.phonemize(text, lang);
    }

    terminate() {
        this.factory.terminate();
    }
}

export const g2pService = new G2PService();
