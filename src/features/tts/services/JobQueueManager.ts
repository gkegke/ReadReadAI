import { createActor, createMachine, assign, fromPromise } from 'xstate';
import { db } from '../../../shared/db';
import { AudioGenerationService } from './AudioGenerationService';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';

/**
 * JobQueueManager (V6 - High Observability)
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
                onError: { 
                    target: 'sleeping',
                    actions: ({ event }) => logger.error('JobQueue', 'Error finding job', event.error)
                }
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
        paused: {
            on: { 
                RESUME: 'checking',
                POKE: 'checking'
            }
        },
        sleeping: {
            after: { 2000: 'checking' }, 
            on: { 
                POKE: 'checking',
                STOP: 'paused'
            }
        }
    }
}, {
    actors: {
        findJob: fromPromise(async () => {
            if (useSystemStore.getState().isStorageFull) {
                logger.warn('JobQueue', 'Skipping check: Storage is full.');
                return null;
            }

            const jobs = await db.jobs.where('status').equals('pending').toArray();
            if (jobs.length === 0) {
                // Low noise log
                return null;
            }

            // [LOGGING] Evidence of queue activity
            logger.debug('JobQueue', `Found ${jobs.length} pending jobs. Picking highest priority.`);
            
            jobs.sort((a, b) => b.priority - a.priority || a.id! - b.id!);
            return jobs[0];
        }),
        executeJob: fromPromise(async ({ input }: any) => {
            const job = input;
            logger.info('JobQueue', `Starting Chunk [${job.chunkId}] (Priority: ${job.priority})`);
            
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            
            try {
                await AudioGenerationService.generate(job.chunkId);
                await db.jobs.delete(job.id!);
                logger.info('JobQueue', `Completed Chunk [${job.chunkId}]`);
            } catch (e) {
                logger.error('JobQueue', `Failed Chunk [${job.chunkId}]`, e);
                // Move back to pending but lower priority so we don't loop on a broken chunk forever
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
        
        logger.info('JobQueue', 'Initializing Orchestrator...');
        
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks.where('status').equals('processing').modify({ status: 'pending' });
            await db.jobs.where('status').equals('processing').modify({ status: 'pending' });
        });

        this.actor.start();
        this.actor.send({ type: 'START' });
        this.isStarted = true;
    }

    public poke() {
        logger.debug('JobQueue', 'Manual poke received.');
        this.actor.send({ type: 'POKE' });
    }

    public stop() {
        logger.warn('JobQueue', 'Orchestrator Paused by user.');
        this.actor.send({ type: 'STOP' });
    }

    public resume() {
        logger.info('JobQueue', 'Orchestrator Resumed.');
        this.actor.send({ type: 'RESUME' });
    }

    public getStatus() {
        return this.actor.getSnapshot().value;
    }
}

export const jobQueueManager = new JobQueueManager();