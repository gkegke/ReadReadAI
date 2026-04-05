import * as Comlink from 'comlink';
import { createMachine, createActor, assign, fromPromise } from 'xstate';
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
        currentJob: null as any
    },
    states: {
        idle: {
            on: {
                START: {
                    target: 'initializing',
                    actions: assign({ activeModelId: ({ event }) => (event as any).modelId })
                },
                POKE: { target: 'checking' }
            }
        },
        initializing: {
            invoke: {
                src: 'loadModel',
                input: ({ context }) => ({ modelId: context.activeModelId }),
                onDone: { target: 'checking' },
                onError: { target: 'error_cooldown' }
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
                    target: 'sleeping', // Sleep briefly on error to prevent CPU thrashing loop
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
    actors: {
        loadModel: fromPromise(async ({ input }: any) => {
            const { modelId } = input;
            if (!modelId) return null;
            await ttsService.loadModel(modelId);
            return modelId;
        }),
        findJob: fromPromise(async () => {
            return await navigator.locks.request('readread-job-orchestrator', { ifAvailable: true }, async (lock) => {
                if (!lock) return null;
                const jobs = await db.jobs.where('status').equals('pending').toArray();
                if (jobs.length === 0) return null;

                // Priority sort: Highest priority first, then oldest (lowest ID)
                jobs.sort((a, b) => b.priority - a.priority || a.id! - b.id!);
                return jobs[0];
            });
        }),
        executeJob: fromPromise(async ({ input }: any) => {
            const job = input;
            if (!job) throw new Error("No job provided");

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
                // Mark as failed so it drops out of the pending queue and prevents infinite loops
                await db.jobs.update(job.id!, { status: 'failed', updatedAt: new Date() });
                throw e;
            }
        })
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
