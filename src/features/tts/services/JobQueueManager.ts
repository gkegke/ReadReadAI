// [FILE: /web/src/features/tts/services/JobQueueManager.ts]
import * as Comlink from 'comlink';
import ManagerWorker from '../workers/manager.worker?worker';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { db } from '../../../shared/db';

class JobQueueManager {
    private worker: any = null;
    private rawWorker: Worker | null = null;

    public async init() {
        // [CRITICAL] If worker exists, check if it's responsive. 
        // If stop() was called, this.worker will be null, allowing fresh init.
        if (this.worker) return; 
        
        try {
            await db.transaction('rw', [db.chunks, db.jobs], async () => {
                const zombieChunks = await db.chunks.where('status').equals('processing').toArray();
                const zombieJobs = await db.jobs.where('status').equals('processing').toArray();
                
                for (const z of zombieChunks) {
                    await db.chunks.update(z.id!, { status: 'pending', updatedAt: new Date() });
                }
                for (const j of zombieJobs) {
                    await db.jobs.update(j.id!, { status: 'pending', updatedAt: new Date() });
                }
            });

            this.rawWorker = new ManagerWorker();
            this.worker = Comlink.wrap(this.rawWorker);
            
            const { activeModelId } = useSystemStore.getState();
            await this.worker.start(activeModelId);
            
            logger.info('JobQueue', 'Orchestrator online.', { model: activeModelId });
        } catch (err) {
            logger.error('JobQueue', 'Failed to initialize background worker', err);
        }
    }

    public async poke() {
        if (this.worker) {
            try {
                await this.worker.checkNow();
            } catch (e) {
                logger.warn('JobQueue', 'Failed to poke worker - likely terminated.');
            }
        }
    }

    public async restart(newModelId: string) {
        await this.stop();
        await this.init();
    }

    /**
     * [FIX: ISSUE 2] Explicitly teardown worker and proxy.
     * Setting this.worker to null ensures that the next call to init() 
     * doesn't return early with a dead actor reference.
     */
    public async stop() {
        if (this.worker) {
            logger.info('JobQueue', 'Stopping orchestrator and terminating worker thread.');
            try {
                await this.worker.stop();
            } catch (e) {
                // Ignore errors during termination
            }
            this.worker = null;
        }
        if (this.rawWorker) {
            this.rawWorker.terminate();
            this.rawWorker = null;
        }
    }
}

export const jobQueueManager = new JobQueueManager();