import * as Comlink from 'comlink';
import { db } from '../../../shared/db';
import { AudioGenerationService } from '../services/AudioGenerationService';
import { ttsService } from '../services/TTSService';
import { logger } from '../../../shared/services/Logger';

/**
 * ManagerWorker
 * CRITICAL: This is the brain of the "Zero-Cloud" engine. 
 * It runs entirely in the background, monitoring the database for work.
 */
class ManagerWorkerImpl {
    private isRunning = false;
    private isProcessing = false;
    private activeModelId: string | null = null;

    public async start(modelId: string) {
        if (this.isRunning) return;
        
        if (this.activeModelId !== modelId) {
            logger.info('ManagerWorker', `Initializing Headless TTS with model: ${modelId}`);
            try {
                await ttsService.loadModel(modelId);
                this.activeModelId = modelId;
            } catch (e) {
                logger.error('ManagerWorker', 'Failed to init headless model', e);
                return;
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
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    private async processQueue() {
        if (this.isProcessing) return;
        
        if (!navigator.locks) {
            await this.executeOneJob();
            return;
        }

        await navigator.locks.request('readread-job-orchestrator', { ifAvailable: true }, async (lock) => {
            if (!lock) return;
            this.isProcessing = true;
            try {
                await this.executeOneJob();
            } finally {
                this.isProcessing = false;
            }
        });
    }

    private async executeOneJob() {
        await this.cleanupStuckJobs();

        const job = await db.jobs
            .where('status').equals('pending')
            .reverse().sortBy('priority')
            .then(list => list[0]);

        if (!job) return;

        try {
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            
            // Invoke the generation logic
            await AudioGenerationService.generate(job.chunkId);
            
            await db.jobs.delete(job.id!);
            
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
        const cutoff = new Date(Date.now() - 120000);
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