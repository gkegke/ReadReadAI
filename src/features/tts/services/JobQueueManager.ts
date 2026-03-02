import * as Comlink from 'comlink';
import ManagerWorker from '../workers/manager.worker?worker';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { db } from '../../../shared/db';

class JobQueueManager {
    private worker: any = null;

    public async init() {
        if (this.worker) return; 
        
        try {
            // [EPIC 5] Robust Zombie State Recovery
            // If the browser crashed or OOM'd, chunks stay 'processing'. This sweep resets them.
            await db.transaction('rw', [db.chunks, db.jobs], async () => {
                const zombieChunks = await db.chunks.where('status').equals('processing').toArray();
                const zombieJobs = await db.jobs.where('status').equals('processing').toArray();
                
                for (const z of zombieChunks) {
                    await db.chunks.update(z.id!, { status: 'pending', updatedAt: new Date() });
                }
                for (const j of zombieJobs) {
                    await db.jobs.update(j.id!, { status: 'pending', updatedAt: new Date() });
                }
                
                if (zombieChunks.length > 0) {
                    logger.info('JobQueue', `Reclaimed ${zombieChunks.length} chunks from previous crash.`);
                }
            });

            const rawWorker = new ManagerWorker();
            this.worker = Comlink.wrap(rawWorker);
            
            const { activeModelId } = useSystemStore.getState();
            await this.worker.start(activeModelId);
            
            logger.info('JobQueue', 'Orchestrator online.', { model: activeModelId });
        } catch (err) {
            logger.error('JobQueue', 'Failed to initialize background worker', err);
        }
    }

    public async poke() {
        if (this.worker) await this.worker.checkNow();
    }

    public async restart(newModelId: string) {
        if (this.worker) {
            logger.info('JobQueue', `Restarting queue with model: ${newModelId}`);
            await this.worker.stop();
            await this.worker.start(newModelId);
        }
    }

    public stop() {
        if (this.worker) this.worker.stop();
    }
}

export const jobQueueManager = new JobQueueManager();