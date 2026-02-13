import * as Comlink from 'comlink';
import { logger } from '../services/Logger';

/**
 * Robust Worker Factory (V4)
 * Wraps Comlink with hardware-aware auto-restart and structured error logging.
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
            
            // Native Event Listener for Uncaught Worker Errors
            this.worker.onerror = (err) => {
                logger.error('WorkerFactory', `${this.name} Thread Crashed`, {
                    message: err.message,
                    filename: err.filename,
                    lineno: err.lineno
                });
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

        // Exponential Backoff could be added here; 1s is safe for most OOMs
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
            if (!this.isTerminated) {
                logger.warn('WorkerFactory', `Auto-Restarting ${this.name} context...`);
                this.init();
            }
        }, 1500);
    }

    public terminate() {
        this.isTerminated = true;
        clearTimeout(this.restartTimer);
        if (this.worker) this.worker.terminate();
    }
}