import { createMachine, createActor, assign, fromPromise, type Actor } from 'xstate';
import { logger } from '../../../shared/services/Logger';

// [STABILITY] Explicitly define the worklet path using the standard Vite URL constructor
const workletUrl = new URL('../workers/audio-processor.ts', import.meta.url).href;

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

const playbackMachine = createMachine({
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
            on: {
                HYDRATE: { target: PlaybackState.INITIALIZING },
                PLAY: { 
                    target: PlaybackState.INITIALIZING,
                    actions: 'assignPlayData' 
                },
                CLEAR_CACHE: {
                    actions: assign({
                        bufferCache: () => new Map()
                    })
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
                    actions: 'clearPendingPlayData' 
                },
                onError: { target: PlaybackState.ERROR }
            }
        },
        [PlaybackState.PLAYING]: {
            entry: 'resumeAudio',
            on: {
                TOGGLE: { target: PlaybackState.PAUSED },
                OS_SUSPEND: { target: PlaybackState.PAUSED },
                PLAY: { 
                    target: PlaybackState.BUFFERING,
                    actions: 'assignPlayData'
                },
                STOP: { 
                    target: PlaybackState.IDLE, 
                    actions: ['stopAudio', assign({ activeChunkId: null })] 
                },
                ENDED: { target: PlaybackState.IDLE },
                CLEAR_CACHE: { actions: 'clearBuffers' }
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
                STOP: { 
                    target: PlaybackState.IDLE,
                    actions: ['stopAudio', assign({ activeChunkId: null })]
                },
                CLEAR_CACHE: { actions: 'clearBuffers' }
            }
        },
        [PlaybackState.ERROR]: {
            on: {
                PLAY: { target: PlaybackState.INITIALIZING, actions: 'assignPlayData' },
                STOP: { target: PlaybackState.IDLE }
            }
        }
    }
});

export class AudioPlaybackService {
    private onProgress: ProgressCallback | null = null;
    private onEnded: EndedCallback | null = null;
    public actor: Actor<typeof playbackMachine>;

    constructor() {
        const machineWithImpls = playbackMachine.provide({
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
                    context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: true });
                },
                stopAudio: ({ context }) => {
                    context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: true });
                    context.workletNode?.port.postMessage({ type: 'CLEAR' });
                    context.ctx?.suspend();
                },
                clearBuffers: assign({
                    bufferCache: () => new Map()
                })
            },
            actors: {
                setupAudioContext: fromPromise(async ({ input }) => {
                    let { ctx, workletNode } = input;
                    if (!ctx) {
                        ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 24000 });
                        ctx.onstatechange = () => {
                            if (ctx?.state === 'suspended') {
                                this.actor.send({ type: 'OS_SUSPEND' });
                            }
                        };
                    }
                    if (ctx.state === 'suspended') await ctx.resume();
                    if (!workletNode) {
                        // Using the evaluated URL string
                        await ctx.audioWorklet.addModule(workletUrl);
                        workletNode = new AudioWorkletNode(ctx, 'audio-stream-processor');
                        workletNode.connect(ctx.destination);
                        workletNode.port.onmessage = (e: MessageEvent) => {
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

        this.actor = createActor(machineWithImpls).start();
    }

    public bind(onProgress: ProgressCallback, onEnded: EndedCallback) {
        this.onProgress = onProgress;
        this.onEnded = onEnded;
    }

    public async hydrate() { 
        this.actor.send({ type: 'HYDRATE' }); 
    }
    
    public playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        this.actor.send({ type: 'PLAY', chunkId, blob, offset });
    }

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
        } catch (e) {
            logger.error('PlaybackService', 'Preload decode failed', e);
        }
    }

    public clearBufferCache() {
        this.actor.send({ type: 'CLEAR_CACHE' });
    }

    public toggle() { this.actor.send({ type: 'TOGGLE' }); }
    public stop() { this.actor.send({ type: 'STOP' }); }
    public get state(): PlaybackState { return this.actor.getSnapshot().value as PlaybackState; }
}

export const audioPlaybackService = new AudioPlaybackService();