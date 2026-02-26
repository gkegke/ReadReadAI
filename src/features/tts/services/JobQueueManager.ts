import * as Comlink from 'comlink';
import ManagerWorker from '../workers/manager.worker?worker';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';

/**
 * JobQueueManager (V2.1 - Explicit Initialization)
 * CRITICAL: UI-Thread Proxy. 
 * [EPIC 1] Removed arbitrary setTimeout from constructor to ensure
 * deterministic orchestration startup via App.tsx
 */
class JobQueueManager {
    private worker: any = null;

    public async init() {
        if (this.worker) return; // Prevent double initialization
        
        try {
            const rawWorker = new ManagerWorker();
            this.worker = Comlink.wrap(rawWorker);
            
            // Get the preferred model from the system store
            const { activeModelId } = useSystemStore.getState();

            // Start the background orchestrator
            await this.worker.start(activeModelId);
            logger.info('JobQueue', 'Background Orchestrator Started', { activeModelId });
        } catch (err) {
            logger.error('JobQueue', 'Failed to start background worker', err);
        }
    }

    public async poke() {
        if (this.worker) await this.worker.checkNow();
    }

    public async restart(newModelId: string) {
        if (this.worker) {
            await this.worker.stop();
            await this.worker.start(newModelId);
        }
    }

    public stop() {
        if (this.worker) this.worker.stop();
    }
}

export const jobQueueManager = new JobQueueManager();