import { createActor, createMachine, assign, fromPromise } from 'xstate';
import { db } from '../../../shared/db';
import { AudioGenerationService } from './AudioGenerationService';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';

/**
 * JobQueueManager (V5 - Main Thread Dispatcher)
 * [CRITICAL] Moved out of a Web Worker to avoid "Nested Worker" compatibility issues.
 * The Dispatcher runs on the main thread, but the AI work is still performed
 * by the TTS Worker via the ttsService.
 */

const managerMachine = createMachine({
    id: 'jobManager',
    initial: 'idle',
    context: {
        consecutiveErrors: 0,
        currentJob: null as any
    },
    states: {
        idle: {
            on: {
                START: { target: 'checking' },
                POKE: { target: 'checking' }
            }
        },
        checking: {
            invoke: {
                src: 'findJob',
                onDone: [
                    { 
                        target: 'processing', 
                        guard: ({ event }) => !!event.output, 
                        actions: assign({ currentJob: ({ event }) => event.output }) 
                    },
                    { target: 'sleeping' }
                ],
                onError: { target: 'sleeping' }
            }
        },
        processing: {
            invoke: {
                src: 'executeJob',
                input: ({ context }) => context.currentJob,
                onDone: { target: 'checking', actions: assign({ consecutiveErrors: 0 }) },
                onError: { 
                    target: 'sleeping', 
                    actions: assign({ consecutiveErrors: ({ context }) => context.consecutiveErrors + 1 }) 
                }
            }
        },
        sleeping: {
            after: { 3000: 'checking' }, 
            on: { POKE: 'checking' }
        }
    }
}, {
    actors: {
        findJob: fromPromise(async () => {
            // [EPIC 6] Respect storage quota
            if (useSystemStore.getState().isStorageFull) return null;

            return await navigator.locks.request('readread-job-orchestrator', { ifAvailable: true }, async (lock) => {
                if (!lock) return null;
                const jobs = await db.jobs.where('status').equals('pending').toArray();
                if (jobs.length === 0) return null;

                // Priority sort: Higher number = higher priority
                jobs.sort((a, b) => b.priority - a.priority || a.id! - b.id!);
                return jobs[0];
            });
        }),
        executeJob: fromPromise(async ({ input }: any) => {
            const job = input;
            const startTime = Date.now();
            
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            
            try {
                await AudioGenerationService.generate(job.chunkId);
                await db.jobs.delete(job.id!);
                
                logger.debug('JobQueue', `Job [${job.chunkId}] success`, { ms: Date.now() - startTime });
            } catch (e) {
                logger.error('JobQueue', `Job [${job.chunkId}] failed`, e);
                await db.jobs.update(job.id!, { status: 'pending', priority: 0, updatedAt: new Date() });
                throw e; 
            }
        })
    }
});

class JobQueueManager {
    private actor = createActor(managerMachine);
    private isStarted = false;

    public async init() {
        if (this.isStarted) return;
        
        // Cleanup zombie states from previous sessions
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks.where('status').equals('processing').modify({ status: 'pending' });
            await db.jobs.where('status').equals('processing').modify({ status: 'pending' });
        });

        this.actor.start();
        this.actor.send({ type: 'START' });
        this.isStarted = true;
        logger.info('JobQueue', 'Main-thread orchestrator online.');
    }

    public poke() {
        if (this.isStarted) {
            this.actor.send({ type: 'POKE' });
        }
    }

    public stop() {
        this.actor.stop();
        this.isStarted = false;
    }
}

export const jobQueueManager = new JobQueueManager();