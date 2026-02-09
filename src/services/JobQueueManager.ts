import { db } from '../db';
import { AudioGenerationService } from './AudioGenerationService';
import { liveQuery } from 'dexie';

/**
 * JobQueueManager
 * 
 * REACTIVE & CONCURRENTLY SAFE:
 * Uses Dexie liveQuery to observe the DB.
 * Uses Web Locks API to ensure only ONE tab/worker acts as the processor.
 */
class JobQueueManager {
    private subscription: { unsubscribe: () => void } | null = null;
    private isLocked = false;

    constructor() {
        this.init();
    }

    private init() {
        // Observe the queue for ANY pending work
        const pendingJobQuery = liveQuery(() => 
            db.jobs
                .where('status')
                .equals('pending')
                .count()
        );

        this.subscription = pendingJobQuery.subscribe({
            next: (count) => {
                if (count > 0 && !this.isLocked) {
                    this.attemptProcess();
                }
            },
            error: (err) => console.error("[JobQueue] Subscription error:", err)
        });

        // Cleanup stale jobs on boot
        this.cleanupStuckJobs();
    }

    /**
     * Uses the Web Locks API to elect a leader to process the queue.
     * If another tab is holding the lock, this request will wait (or abort based on options).
     * We use 'ifAvailable' mode so we don't block; we just try again on next DB change.
     */
    private async attemptProcess() {
        if (!navigator.locks) {
            // Fallback for very old browsers: just run it unsafe
            this.processQueue();
            return;
        }

        navigator.locks.request('readread-queue-processor', { ifAvailable: true }, async (lock) => {
            if (!lock) {
                // Another tab is processing. We can chill.
                return;
            }
            this.isLocked = true;
            await this.processQueue();
            this.isLocked = false;
        });
    }

    private async processQueue() {
        // Grab the single highest priority job
        // We re-query inside the lock to be sure
        const job = await db.jobs
            .where('status')
            .equals('pending')
            .reverse()
            .sortBy('priority')
            .then(list => list[0]);

        if (!job) return;

        try {
            // 1. Mark as processing (Atomic-ish)
            await db.jobs.update(job.id!, { status: 'processing' });

            // 2. Execute
            await AudioGenerationService.generate(job.chunkId);
            
            // 3. Complete
            await db.jobs.delete(job.id!);

            // 4. Recurse immediately if there are more jobs (keeps the lock held)
            // This prevents "thrashing" the lock release/acquire
            const nextCount = await db.jobs.where('status').equals('pending').count();
            if (nextCount > 0) {
                await this.processQueue();
            }

        } catch (error) {
            console.error(`[JobQueue] Job ${job.id} failed:`, error);
            
            const currentJob = await db.jobs.get(job.id!);
            if (currentJob) {
                if ((currentJob.retryCount || 0) >= 2) {
                    await db.jobs.update(job.id!, { status: 'failed' });
                } else {
                    await db.jobs.update(job.id!, { 
                        status: 'pending', 
                        retryCount: (currentJob.retryCount || 0) + 1,
                        priority: Math.max(0, currentJob.priority - 5) 
                    });
                }
            }
        }
    }

    private async cleanupStuckJobs() {
        const oneMinuteAgo = new Date(Date.now() - 60000);
        await db.jobs
            .where('status').equals('processing')
            .filter(j => j.createdAt < oneMinuteAgo) 
            .modify({ status: 'pending', retryCount: 0 });
    }

    public stop() {
        this.subscription?.unsubscribe();
    }
}

export const jobQueueManager = new JobQueueManager();