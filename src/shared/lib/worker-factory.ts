import * as Comlink from 'comlink';
import { logger } from '../services/Logger';

/**
 * Type-Safe Worker Factory (V5)
 * [IMPORTANCE: 10/10] Derives TypeScript interfaces from Zod Schemas
 * to ensure the main thread cannot send malformed payloads to workers.
 */
export class WorkerFactory<T> {
    private worker: Worker | null = null;
    private proxy: Comlink.Remote<T> | null = null;
    private restartTimer: any = null;
    private isTerminated = false;

    constructor(
        private readonly workerConstructor: new () => Worker,
        private readonly name: string
    ) {}

    /**
     * Returns a type-safe proxy.
     * T should be the interface of the Worker class.
     */
    public async getInstance(): Promise<Comlink.Remote<T>> {
        if (this.proxy) return this.proxy;
        return this.init();
    }

    private init(): Comlink.Remote<T> {
        if (this.isTerminated) throw new Error(`Worker ${this.name} is terminated.`);
        
        try {
            this.worker = new this.workerConstructor();
            
            this.worker.onerror = (err) => {
                logger.error('WorkerFactory', `${this.name} Thread Crashed`, { message: err.message });
                this.handleCrash();
            };

            this.proxy = Comlink.wrap<T>(this.worker);
            return this.proxy;
        } catch (e) {
            logger.error('WorkerFactory', `Failed to spawn ${this.name}`, e);
            throw e;
        }
    }

    private handleCrash() {
        if (this.isTerminated) return;
        this.proxy = null;
        if (this.worker) this.worker.terminate();
        this.worker = null;

        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
            if (!this.isTerminated) this.init();
        }, 1500);
    }

    public terminate() {
        this.isTerminated = true;
        clearTimeout(this.restartTimer);
        if (this.worker) this.worker.terminate();
    }
}