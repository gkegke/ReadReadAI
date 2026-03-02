import { createMachine, createActor, assign, fromPromise } from 'xstate';
import { logger } from '../../../shared/services/Logger';
import workletUrl from '../workers/audio-processor.ts?url';

export enum PlaybackState {
    IDLE = 'IDLE',
    INITIALIZING = 'INITIALIZING',
    BUFFERING = 'BUFFERING',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    ERROR = 'ERROR'
}

type ProgressCallback = (currentTime: number, duration: number) => void;
type EndedCallback = () => void;

interface AudioContextData {
    ctx: AudioContext | null;
    workletNode: AudioWorkletNode | null;
    activeChunkId: number | null;
    bufferCache: Map<number, AudioBuffer>;
    pendingBlob: Blob | null; 
    pendingOffset: number;
}

const MAX_BUFFER_CACHE = 15;

export class AudioPlaybackService {
    private onProgress: ProgressCallback | null = null;
    private onEnded: EndedCallback | null = null;

    private playbackMachine = createMachine({
        id: 'playback',
        initial: PlaybackState.IDLE,
        context: {
            ctx: null,
            workletNode: null,
            activeChunkId: null,
            bufferCache: new Map<number, AudioBuffer>(),
            pendingBlob: null,
            pendingOffset: 0,
        } as AudioContextData,
        states: {
            [PlaybackState.IDLE]: {
                entry: ['clearPendingPlayData'], // [FIX] Removed 'clearMemory' so preloaded buffers aren't immediately evicted
                on: {
                    HYDRATE: { target: PlaybackState.INITIALIZING },
                    PLAY: { 
                        target: PlaybackState.INITIALIZING,
                        actions: 'assignPlayData' 
                    }
                }
            },
            [PlaybackState.INITIALIZING]: {
                invoke: {
                    src: 'setupAudioContext',
                    input: ({ context }) => ({ ctx: context.ctx, workletNode: context.workletNode }),
                    onDone: [
                        {
                            guard: 'hasPendingPlay',
                            target: PlaybackState.BUFFERING,
                            actions: assign({
                                ctx: ({ event }) => event.output.ctx,
                                workletNode: ({ event }) => event.output.workletNode
                            })
                        },
                        {
                            target: PlaybackState.IDLE,
                            actions: assign({
                                ctx: ({ event }) => event.output.ctx,
                                workletNode: ({ event }) => event.output.workletNode
                            })
                        }
                    ],
                    onError: { target: PlaybackState.ERROR }
                }
            },
            [PlaybackState.BUFFERING]: {
                invoke: {
                    src: 'decodeAndPush',
                    input: ({ context }) => ({
                        chunkId: context.activeChunkId,
                        blob: context.pendingBlob,
                        offset: context.pendingOffset,
                        bufferCache: context.bufferCache,
                        ctx: context.ctx,
                        workletNode: context.workletNode
                    }),
                    onDone: { 
                        target: PlaybackState.PLAYING,
                        // [EPIC 1] Immediate blob cleanup after decoding
                        actions: 'clearPendingPlayData' 
                    },
                    onError: { target: PlaybackState.ERROR }
                }
            },
            [PlaybackState.PLAYING]: {
                entry: 'resumeAudio',
                on: {
                    TOGGLE: { target: PlaybackState.PAUSED },
                    OS_SUSPEND: { target: PlaybackState.PAUSED }, // [EPIC 3] Hardware Sync
                    PLAY: { 
                        target: PlaybackState.BUFFERING,
                        actions: 'assignPlayData'
                    },
                    STOP: { target: PlaybackState.IDLE },
                    ENDED: { target: PlaybackState.IDLE }
                }
            },
            [PlaybackState.PAUSED]: {
                entry: 'suspendAudio',
                on: {
                    TOGGLE: { target: PlaybackState.PLAYING },
                    PLAY: { 
                        target: PlaybackState.BUFFERING,
                        actions: 'assignPlayData'
                    },
                    STOP: { target: PlaybackState.IDLE }
                }
            },
            [PlaybackState.ERROR]: {
                on: {
                    PLAY: { target: PlaybackState.INITIALIZING, actions: 'assignPlayData' },
                    STOP: { target: PlaybackState.IDLE }
                }
            }
        }
    }, {
        guards: {
            hasPendingPlay: ({ context }) => context.pendingBlob !== null
        },
        actions: {
            assignPlayData: assign({
                activeChunkId: ({ event }) => (event as any).chunkId,
                pendingBlob: ({ event }) => (event as any).blob,
                pendingOffset: ({ event }) => (event as any).offset || 0
            }),
            clearPendingPlayData: assign({
                pendingBlob: null,
                pendingOffset: 0
            }),
            resumeAudio: ({ context }) => {
                context.ctx?.resume();
                context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: false });
            },
            suspendAudio: ({ context }) => {
                context.ctx?.suspend();
                context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: true });
            },
            clearMemory: ({ context }) => {
                context.bufferCache.clear();
            }
        },
        actors: {
            setupAudioContext: fromPromise(async ({ input }) => {
                let { ctx, workletNode } = input;
                if (!ctx) {
                    ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 24000 });
                    // [EPIC 3] Listen for OS/Browser power-saving suspension
                    ctx.onstatechange = () => {
                        if (ctx?.state === 'suspended') {
                            this.actor.send({ type: 'OS_SUSPEND' });
                        }
                    };
                }
                if (ctx.state === 'suspended') await ctx.resume();
                if (!workletNode) {
                    await ctx.audioWorklet.addModule(workletUrl);
                    workletNode = new AudioWorkletNode(ctx, 'audio-stream-processor');
                    workletNode.connect(ctx.destination);
                    workletNode.port.onmessage = (e) => {
                        if (e.data.type === 'PROGRESS' && this.onProgress) {
                            this.onProgress(e.data.processedFrames / 24000, e.data.totalFrames / 24000);
                        }
                        if (e.data.type === 'ENDED') {
                            this.actor.send({ type: 'ENDED' });
                            if (this.onEnded) this.onEnded();
                        }
                    };
                }
                return { ctx, workletNode };
            }),
            decodeAndPush: fromPromise(async ({ input }: { input: any }) => {
                const { chunkId, blob, offset, bufferCache, ctx, workletNode } = input;
                if (chunkId === null || !blob) throw new Error("Missing play data");

                if (bufferCache.size > MAX_BUFFER_CACHE) {
                    bufferCache.delete(bufferCache.keys().next().value);
                }

                let buffer = bufferCache.get(chunkId);
                if (!buffer) {
                    buffer = await ctx!.decodeAudioData(await blob.arrayBuffer());
                    bufferCache.set(chunkId, buffer);
                }

                workletNode?.port.postMessage({ type: 'CLEAR' });
                const pcmData = buffer.getChannelData(0);
                const startFrame = Math.floor(offset * buffer.sampleRate);
                
                workletNode?.port.postMessage({ 
                    type: 'PUSH_DATA', 
                    audio: startFrame > 0 ? pcmData.slice(startFrame) : pcmData,
                    immediate: true 
                });

                return { chunkId };
            })
        }
    });

    public actor = createActor(this.playbackMachine).start();

    public bind(onProgress: ProgressCallback, onEnded: EndedCallback) {
        this.onProgress = onProgress;
        this.onEnded = onEnded;
    }

    public async hydrate() { this.actor.send({ type: 'HYDRATE' }); }
    
    public playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        this.actor.send({ type: 'PLAY', chunkId, blob, offset });
    }

    /**
     * [FIX: Gapless Playback] Exposes a method to pre-decode and stash audio in the buffer cache
     * so that the instant playChunk is called, the audio is ready in RAM.
     */
    public async queueNextChunk(chunkId: number, blob: Blob) {
        const { ctx, bufferCache } = this.actor.getSnapshot().context;
        if (!ctx) return;
        if (bufferCache.has(chunkId)) return;
        try {
            if (bufferCache.size > MAX_BUFFER_CACHE) {
                bufferCache.delete(bufferCache.keys().next().value!);
            }
            const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            bufferCache.set(chunkId, buffer);
            logger.debug('PlaybackService', `Pre-buffered chunk ${chunkId}`);
        } catch (e) {
            logger.error('PlaybackService', 'Preload decode failed', e);
        }
    }

    public toggle() { this.actor.send({ type: 'TOGGLE' }); }
    public stop() { this.actor.send({ type: 'STOP' }); }
    public get state(): PlaybackState { return this.actor.getSnapshot().value as PlaybackState; }
}

export const audioPlaybackService = new AudioPlaybackService();