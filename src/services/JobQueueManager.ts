import { db } from '../db';
import { AudioGenerationService } from './AudioGenerationService';
import { liveQuery, Subscription } from 'dexie';

class JobQueueManager {
    private subscription: Subscription | null = null;
    private isLocked = false;
    private processingId: number | null = null;

    constructor() {
        this.init();
        
        // Safety net: Release lock processing status on unload
        window.addEventListener('beforeunload', () => {
            if (this.processingId) {
                // We can't await here, but we can try to fire a quick status reset
                // or rely on the cleanupStuckJobs of the next instance.
            }
        });
    }

    private init() {
        this.cleanupStuckJobs().then(() => {
             const pendingJobQuery = liveQuery(() => 
                db.jobs.where('status').equals('pending').count()
            );

            this.subscription = pendingJobQuery.subscribe({
                next: (count) => {
                    if (count > 0 && !this.isLocked) this.attemptProcess();
                },
                error: (err) => console.error("[JobQueue] Error:", err)
            });
        });
    }

    private async attemptProcess() {
        if (!navigator.locks) { this.processQueue(); return; }

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

        this.processingId = job.id!;

        try {
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            await AudioGenerationService.generate(job.chunkId);
            await db.jobs.delete(job.id!);
        } catch (error) {
            console.error(`[JobQueue] Job ${job.id} failed:`, error);
            // Simple retry logic
            const fresh = await db.jobs.get(job.id!);
            if (fresh) {
                if (fresh.retryCount >= 3) {
                    await db.jobs.update(job.id!, { status: 'failed' });
                } else {
                    await db.jobs.update(job.id!, { 
                        status: 'pending', 
                        retryCount: fresh.retryCount + 1,
                        priority: 0 // Drop priority
                    });
                }
            }
        } finally {
            this.processingId = null;
            // Immediate recurse
            const nextCount = await db.jobs.where('status').equals('pending').count();
            if (nextCount > 0) await this.processQueue();
        }
    }

    /**
     * Resets jobs that have been 'processing' for too long (zombies).
     * This runs on app boot.
     */
    private async cleanupStuckJobs() {
        const TWO_MINUTES = 2 * 60 * 1000;
        const cutoff = new Date(Date.now() - TWO_MINUTES);
        
        // Note: In a real app we might check a 'heartbeat' field, 
        // but for MVP, 2 minutes is a safe "crashed" assumption.
        const stuckJobs = await db.jobs
            .where('status').equals('processing')
            .filter(j => j.createdAt < cutoff) // Should verify 'updatedAt' if available
            .toArray();

        if (stuckJobs.length > 0) {
            console.warn(`[JobQueue] Resetting ${stuckJobs.length} stuck jobs.`);
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