import * as Comlink from 'comlink';
import ManagerWorker from '../workers/manager.worker?worker';
import { logger } from './Logger';
import { useSystemStore } from '../store/useSystemStore';

/**
 * JobQueueManager (V2)
 * CRITICAL: UI-Thread Proxy.
 */
class JobQueueManager {
    private worker: any = null;

    constructor() {
        // We delay init slightly to allow Hydration of stores
        setTimeout(() => this.init(), 1000);
    }

    private async init() {
        try {
            const rawWorker = new ManagerWorker();
            this.worker = Comlink.wrap(rawWorker);
            
            // Get the preferred model from the system store (persisted in localStorage)
            // Since this runs in the UI thread, we can access the store.
            const { activeModelId } = useSystemStore.getState();

            // Start the background orchestrator with the correct model
            await this.worker.start(activeModelId);
            logger.info('JobQueue', 'Background Orchestrator Started', { activeModelId });
        } catch (err) {
            logger.error('JobQueue', 'Failed to start background worker', err);
        }
    }

    /**
     * Allows UI to manually trigger a re-scan (e.g., after user edit)
     */
    public async poke() {
        if (this.worker) await this.worker.checkNow();
    }

    /**
     * Restart the worker if model changes
     */
    public async restart(newModelId: string) {
        if (this.worker) {
            await this.worker.stop();
            // Re-initialize with new model
            await this.worker.start(newModelId);
        }
    }

    public stop() {
        if (this.worker) this.worker.stop();
    }
}

export const jobQueueManager = new JobQueueManager();