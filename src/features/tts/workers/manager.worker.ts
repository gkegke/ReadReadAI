import * as Comlink from 'comlink';
import { createMachine, createActor, assign } from 'xstate';
import { db } from '../../../shared/db';
import { AudioGenerationService } from '../services/AudioGenerationService';
import { ttsService } from '../services/TTSService';
import { logger } from '../../../shared/services/Logger';

const managerMachine = createMachine({
    id: 'jobManager',
    initial: 'idle',
    context: {
        activeModelId: null as string | null,
        consecutiveErrors: 0,
    },
    states: {
        idle: {
            on: {
                START: { target: 'initializing' },
                POKE: { target: 'checking' }
            }
        },
        initializing: {
            invoke: {
                src: 'loadModel',
                onDone: {
                    target: 'checking',
                    actions: assign({ activeModelId: ({ event }) => event.output })
                },
                onError: { target: 'error_cooldown' }
            }
        },
        checking: {
            invoke: {
                src: 'findJob',
                onDone: [
                    { target: 'processing', guard: 'hasJob', actions: assign({ currentJob: ({ event }) => event.output }) },
                    { target: 'sleeping' }
                ],
                onError: { target: 'sleeping' }
            }
        },
        processing: {
            invoke: {
                src: 'executeJob',
                onDone: { target: 'checking', actions: assign({ consecutiveErrors: 0 }) },
                onError: { 
                    target: 'checking', 
                    actions: assign({ consecutiveErrors: ({ context }) => context.consecutiveErrors + 1 }) 
                }
            }
        },
        sleeping: {
            after: { 2000: 'checking' }, 
            on: { POKE: 'checking' }
        },
        error_cooldown: {
            after: { 5000: 'initializing' }
        }
    }
}, {
    guards: {
        hasJob: ({ event }) => !!event.output
    },
    actors: {
        loadModel: async ({ event }) => {
            const { modelId } = event as { modelId: string };
            await ttsService.loadModel(modelId);
            return modelId;
        },
        findJob: async () => {
            return await navigator.locks.request('readread-job-orchestrator', { ifAvailable: true }, async (lock) => {
                if (!lock) return null;
                return await db.jobs
                    .where('status').equals('pending')
                    .reverse().sortBy('priority')
                    .then(list => list[0]);
            });
        },
        executeJob: async ({ event }) => {
            const job = event.output;
            const startTime = Date.now();
            const waitTime = startTime - job.createdAt.getTime();
            
            logger.debug('JobQueue', `Dequeued Job [${job.chunkId}]`, { waitTimeMs: waitTime });
            
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });
            
            try {
                await AudioGenerationService.generate(job.chunkId);
                await db.jobs.delete(job.id!);
                
                const execTime = Date.now() - startTime;
                logger.info('JobQueue', `Job [${job.chunkId}] Completed`, { 
                    execTimeMs: execTime, 
                    totalTimeMs: waitTime + execTime 
                });
            } catch (e) {
                logger.error('JobQueue', `Job [${job.chunkId}] Failed`, e);
                throw e; 
            }
        }
    }
});

class ManagerWorkerImpl {
    private actor = createActor(managerMachine).start();

    public async start(modelId: string) {
        this.actor.send({ type: 'START', modelId });
    }

    public async checkNow() {
        this.actor.send({ type: 'POKE' });
    }

    public async stop() {
        this.actor.stop();
    }
}

Comlink.expose(new ManagerWorkerImpl());