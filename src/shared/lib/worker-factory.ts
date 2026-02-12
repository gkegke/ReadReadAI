import * as Comlink from 'comlink';
import { logger } from '../services/Logger';

/**
 * Robust Worker Factory
 * Wraps Comlink with auto-restart logic and error boundaries.
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

    public async getInstance(): Promise<Comlink.Remote<T>> {
        if (this.proxy) return this.proxy;
        return this.init();
    }

    private init(): Comlink.Remote<T> {
        if (this.isTerminated) throw new Error(`Worker ${this.name} is terminated.`);
        
        logger.info('WorkerFactory', `Spawning ${this.name}...`);
        
        try {
            this.worker = new this.workerConstructor();
            
            // Native Error Listener
            this.worker.onerror = (err) => {
                logger.error('WorkerFactory', `${this.name} Crashed`, err);
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
        
        // Dispose old
        this.proxy = null;
        if (this.worker) this.worker.terminate();
        this.worker = null;

        // Debounced Restart
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
            logger.warn('WorkerFactory', `Restarting ${this.name}...`);
            this.init();
        }, 1000);
    }

    public terminate() {
        this.isTerminated = true;
        if (this.worker) this.worker.terminate();
    }
}