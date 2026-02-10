import { db } from '../db';
import { AudioGenerationService } from './AudioGenerationService';
import { liveQuery, Subscription } from 'dexie';
import { logger } from './Logger';

class JobQueueManager {
    private subscription: Subscription | null = null;
    private isLocked = false;

    constructor() {
        this.init();
    }

    private init() {
        this.cleanupStuckJobs().then(() => {
             const pendingJobQuery = liveQuery(() => 
                db.jobs.where('status').equals('pending').count()
            );

            this.subscription = pendingJobQuery.subscribe({
                next: (count) => {
                    if (count > 0 && !this.isLocked) {
                        logger.debug('JobQueue', `Detected ${count} pending jobs.`);
                        this.attemptProcess();
                    }
                },
                error: (err) => logger.error('JobQueue', 'Subscription error', err)
            });
        });
    }

    private async attemptProcess() {
        if (!navigator.locks) { 
            this.processQueue(); 
            return; 
        }

        navigator.locks.request('readread-queue-processor', { ifAvailable: true }, async (lock) => {
            if (!lock) return;
            this.isLocked = true;
            await this.processQueue();
            this.isLocked = false;
        });
    }

    private async processQueue() {
        const job = await db.jobs
            .where('status').equals('pending')
            .reverse().sortBy('priority')
            .then(list => list[0]);

        if (!job) return;

        try {
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            await AudioGenerationService.generate(job.chunkId);
            await db.jobs.delete(job.id!);
        } catch (error) {
            logger.error('JobQueue', `Job ${job.id} failed`, { error: String(error) });
            const fresh = await db.jobs.get(job.id!);
            if (fresh) {
                if (fresh.retryCount >= 3) {
                    await db.jobs.update(job.id!, { status: 'failed' });
                } else {
                    await db.jobs.update(job.id!, { 
                        status: 'pending', 
                        retryCount: fresh.retryCount + 1,
                        priority: 0 
                    });
                }
            }
        } finally {
            const nextCount = await db.jobs.where('status').equals('pending').count();
            if (nextCount > 0) await this.processQueue();
        }
    }

    private async cleanupStuckJobs() {
        const TWO_MINUTES = 2 * 60 * 1000;
        const cutoff = new Date(Date.now() - TWO_MINUTES);
        
        const stuckJobs = await db.jobs
            .where('status').equals('processing')
            .filter(j => j.createdAt < cutoff)
            .toArray();

        if (stuckJobs.length > 0) {
            logger.warn('JobQueue', `Resetting ${stuckJobs.length} zombie jobs.`);
            await db.jobs.bulkPut(stuckJobs.map(j => ({ 
                ...j, 
                status: 'pending', 
                priority: Math.max(0, j.priority - 1) 
            })));
        }
    }

    public stop() {
        this.subscription?.unsubscribe();
    }
}

export const jobQueueManager = new JobQueueManager();