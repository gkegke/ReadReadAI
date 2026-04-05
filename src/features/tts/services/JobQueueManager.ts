import { createActor, createMachine, assign, fromPromise } from 'xstate';
import { db } from '../../../shared/db';
import { AudioGenerationService } from './AudioGenerationService';
import { logger } from '../../../shared/services/Logger';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../store/useTTSStore';
import { ModelStatus } from '../../../shared/types/tts';

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
            if (useSystemStore.getState().isStorageFull) return null;

            // Do not attempt generation if the AI Engine is unloaded/errored.
            // This stops the infinite "Synthesis failed: Invalid Output" loop.
            if (useTTSStore.getState().modelStatus !== ModelStatus.READY) return null;

            // Respect User Focus. Only process jobs for the project the user is actually looking at.
            const activeId = useProjectStore.getState().activeProjectId;
            if (!activeId) return null;

            const jobs = await db.jobs
                .where('projectId').equals(activeId)
                .and(j => j.status === 'pending')
                .toArray();

            if (jobs.length === 0) return null;

            // Prioritize higher numbers, then older records
            jobs.sort((a, b) => b.priority - a.priority || a.id! - b.id!);
            return jobs[0];
        }),
        executeJob: fromPromise(async ({ input }: any) => {
            const job = input;
            await db.jobs.update(job.id!, { status: 'processing', updatedAt: new Date() });

            try {
                await AudioGenerationService.generate(job.chunkId);
                await db.jobs.delete(job.id!);
                logger.debug('JobQueue', `Generated Chunk ${job.chunkId}`);
            } catch (e) {
                logger.error('JobQueue', `Failed Chunk ${job.chunkId}`, e);
                // Penalize priority to move to back of queue
                await db.jobs.update(job.id!, { status: 'pending', priority: -1, updatedAt: new Date() });
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

        // Cleanup stale 'processing' states from previous crashes
        await db.jobs.where('status').equals('processing').modify({ status: 'pending' });

        this.actor.start();
        this.actor.send({ type: 'START' });
        this.isStarted = true;
    }

    public poke() { this.actor.send({ type: 'POKE' }); }
    public stop() { this.actor.send({ type: 'STOP' }); }
    public resume() { this.actor.send({ type: 'RESUME' }); }
}

export const jobQueueManager = new JobQueueManager();
