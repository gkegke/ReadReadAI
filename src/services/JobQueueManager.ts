import { db } from '../db';
import { AudioGenerationService } from './AudioGenerationService';

/**
 * JobQueueManager
 * 
 * Responsible for processing the persistent job queue in Dexie.
 * Ensures that if the user closes the tab, the work resumes when they return.
 */
class JobQueueManager {
    private isProcessing = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private CONCURRENCY = 1; // Keep to 1 for now to prevent worker overload

    constructor() {
        // Start polling loop
        this.poke();
    }

    /**
     * "Poke" the manager to check for work.
     * Call this when adding new jobs to ensure immediate pickup.
     */
    public poke() {
        if (!this.timer) {
            this.timer = setTimeout(() => this.processNext(), 100);
        }
    }

    private async processNext() {
        this.timer = null;

        if (this.isProcessing) return;

        try {
            // 1. Recover any "stuck" processing jobs (e.g. from crash/reload)
            // If a job has been 'processing' for > 1 minute, reset it.
            const stuckTime = new Date(Date.now() - 60000);
            await db.jobs
                .where('status').equals('processing')
                .filter(j => j.createdAt < stuckTime) 
                .modify({ status: 'pending', retryCount: 0 }); // Simple retry strategy

            // 2. Fetch next highest priority pending job
            const job = await db.jobs
                .where('status').equals('pending')
                .reverse()
                .sortBy('priority')
                .then(list => list[0]);

            if (!job) {
                // No work found, sleep for a bit then check again
                // (Long polling for background tasks)
                this.timer = setTimeout(() => this.processNext(), 2000);
                return;
            }

            this.isProcessing = true;

            // 3. Mark as processing
            await db.jobs.update(job.id!, { status: 'processing' });

            try {
                // 4. Do the work
                await AudioGenerationService.generate(job.chunkId);
                
                // 5. Cleanup on success
                await db.jobs.delete(job.id!);

            } catch (error) {
                console.error(`[JobQueue] Job ${job.id} failed`, error);
                
                // Max retries 3
                if (job.retryCount >= 3) {
                    await db.jobs.update(job.id!, { status: 'failed' });
                } else {
                    await db.jobs.update(job.id!, { 
                        status: 'pending', 
                        retryCount: job.retryCount + 1,
                        priority: job.priority - 10 // Lower priority on retry
                    });
                }
            }
        } catch (e) {
            console.error("[JobQueue] Critical Error", e);
        } finally {
            this.isProcessing = false;
            // Check immediately for more work
            this.poke(); 
        }
    }
}

export const jobQueueManager = new JobQueueManager();