import * as Comlink from 'comlink';
import { logger } from '../services/Logger';

/**
 * Type-Safe Worker Factory (V5)
 * [EPIC 2] Implemented Worker Tearing (`recreate`) to completely sever 
 * WebAssembly memory contexts from the browser and prevent OOMs.
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

    /**
     * Terminate completely halts the worker. It cannot be restarted.
     */
    public terminate() {
        this.isTerminated = true;
        clearTimeout(this.restartTimer);
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.proxy = null;
    }

    /**
     * [CRITICAL] Recreate safely tears down the thread, dumps WASM memory to GC, 
     * and prepares the factory to spin up a fresh context on next getInstance()
     */
    public recreate() {
        logger.info('WorkerFactory', `Tearing down thread [${this.name}] to flush memory.`);
        this.isTerminated = false;
        clearTimeout(this.restartTimer);
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.proxy = null;
    }
}