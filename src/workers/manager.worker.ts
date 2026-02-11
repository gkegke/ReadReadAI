import * as Comlink from 'comlink';
import { db } from '../db';
import { AudioGenerationService } from '../services/AudioGenerationService';
import { ttsService } from '../services/TTSService';
import { logger } from '../services/Logger';

/**
 * ManagerWorker
 * CRITICAL: This is the brain of the "Zero-Cloud" engine. 
 * It runs entirely in the background, monitoring the database for work.
 */
class ManagerWorkerImpl {
    private isRunning = false;
    private isProcessing = false;
    private activeModelId: string | null = null;

    /**
     * Start the background polling loop.
     */
    public async start(modelId: string) {
        if (this.isRunning) return;
        
        // Initialize the HEADLESS TTS Service for this worker
        if (this.activeModelId !== modelId) {
            logger.info('ManagerWorker', `Initializing Headless TTS with model: ${modelId}`);
            try {
                await ttsService.loadModel(modelId);
                this.activeModelId = modelId;
            } catch (e) {
                logger.error('ManagerWorker', 'Failed to init headless model', e);
                return; // Cannot start if model is broken
            }
        }

        this.isRunning = true;
        this.loop();
    }

    public async stop() {
        this.isRunning = false;
    }

    public async checkNow() {
        await this.processQueue();
    }

    private async loop() {
        logger.debug('ManagerWorker', 'Loop started');
        while (this.isRunning) {
            try {
                await this.processQueue();
            } catch (err) {
                console.error("[ManagerWorker] Error in loop", err);
            }
            // Sleep for 1s between checks if idle
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    private async processQueue() {
        if (this.isProcessing) return;
        
        // CRITICAL: Use Web Locks to ensure only ONE worker instance (across all tabs)
        // processes the queue at a time.
        if (!navigator.locks) {
            await this.executeOneJob();
            return;
        }

        await navigator.locks.request('readread-job-orchestrator', { ifAvailable: true }, async (lock) => {
            if (!lock) return; // Another tab is handling it
            this.isProcessing = true;
            try {
                await this.executeOneJob();
            } finally {
                this.isProcessing = false;
            }
        });
    }

    private async executeOneJob() {
        // Cleanup stuck jobs first (those marked processing for > 2 mins)
        await this.cleanupStuckJobs();

        // Get highest priority pending job
        const job = await db.jobs
            .where('status').equals('pending')
            .reverse().sortBy('priority')
            .then(list => list[0]);

        if (!job) return;

        try {
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            
            // Invoke the generation logic (this calls TTSService -> tts.worker)
            // Since we called ttsService.loadModel in start(), this is now safe.
            await AudioGenerationService.generate(job.chunkId);
            
            await db.jobs.delete(job.id!);
            
            // If there's more work, trigger immediately
            if (this.isRunning) setTimeout(() => this.executeOneJob(), 0);
        } catch (error) {
            logger.error('WorkerQueue', `Job ${job.id} failed`, { error: String(error) });
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
        }
    }

    private async cleanupStuckJobs() {
        const cutoff = new Date(Date.now() - 120000); // 2 minutes
        const stuckJobs = await db.jobs
            .where('status').equals('processing')
            .filter(j => j.createdAt < cutoff)
            .toArray();

        if (stuckJobs.length > 0) {
            logger.warn('ManagerWorker', `Resetting ${stuckJobs.length} stuck jobs`);
            await db.jobs.bulkPut(stuckJobs.map(j => ({ ...j, status: 'pending', priority: 0 })));
        }
    }
}

Comlink.expose(new ManagerWorkerImpl());