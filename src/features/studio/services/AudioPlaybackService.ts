import { createMachine, createActor, assign } from 'xstate';
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
    // [CRITICAL] Preserved payload state during intermediate transitions
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
            ctx: null as AudioContext | null,
            workletNode: null as AudioWorkletNode | null,
            activeChunkId: null as number | null,
            bufferCache: new Map<number, AudioBuffer>(),
            pendingBlob: null as Blob | null,
            pendingOffset: 0 as number,
        },
        states: {
            [PlaybackState.IDLE]: {
                entry: 'clearMemory',
                on: {
                    PLAY: { 
                        target: PlaybackState.INITIALIZING,
                        actions: 'assignPlayData' 
                    }
                }
            },
            [PlaybackState.INITIALIZING]: {
                invoke: {
                    src: 'setupAudioContext',
                    onDone: {
                        target: PlaybackState.BUFFERING,
                        actions: assign(({ event }) => ({
                            ctx: event.output.ctx,
                            workletNode: event.output.workletNode
                        }))
                    },
                    onError: { target: PlaybackState.ERROR }
                }
            },
            [PlaybackState.BUFFERING]: {
                invoke: {
                    src: 'decodeAndPush',
                    onDone: { target: PlaybackState.PLAYING },
                    onError: { target: PlaybackState.ERROR }
                }
            },
            [PlaybackState.PLAYING]: {
                entry: 'resumeAudio',
                on: {
                    TOGGLE: { target: PlaybackState.PAUSED },
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
                    PLAY: { 
                        target: PlaybackState.INITIALIZING,
                        actions: 'assignPlayData'
                    }
                }
            }
        }
    }, {
        actions: {
            assignPlayData: assign({
                activeChunkId: ({ event }) => (event as any).chunkId,
                pendingBlob: ({ event }) => (event as any).blob,
                pendingOffset: ({ event }) => (event as any).offset || 0
            }),
            resumeAudio: ({ context }) => {
                context.ctx?.resume();
                context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: false });
                logger.debug('Audio', 'Context Resumed');
            },
            suspendAudio: ({ context }) => {
                context.ctx?.suspend();
                context.workletNode?.port.postMessage({ type: 'SET_PAUSED', paused: true });
                logger.debug('Audio', 'Context Suspended');
            },
            clearMemory: ({ context }) => {
                if (context.bufferCache.size > 0) {
                    logger.debug('Audio', `Clearing ${context.bufferCache.size} buffers from memory`);
                    context.bufferCache.clear();
                }
            }
        },
        actors: {
            setupAudioContext: async () => {
                try {
                    if (this.actor.getSnapshot().context.ctx?.state === 'running') {
                        return { 
                            ctx: this.actor.getSnapshot().context.ctx!, 
                            workletNode: this.actor.getSnapshot().context.workletNode! 
                        };
                    }

                    logger.info('Audio', 'Initializing Worklet Engine...');
                    const ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 24000 });
                    await ctx.audioWorklet.addModule(workletUrl);
                    const workletNode = new AudioWorkletNode(ctx, 'audio-stream-processor');
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
                    return { ctx, workletNode };
                } catch (error) {
                    logger.error('Audio', 'Failed to setup AudioContext', error);
                    throw error;
                }
            },
            decodeAndPush: async ({ context }) => {
                // [CRITICAL] Retrieve guaranteed data preserved during the XState transition
                const { activeChunkId: chunkId, pendingBlob: blob, pendingOffset: offset } = context;
                if (chunkId === null || !blob) throw new Error("Missing play data payload");

                if (context.bufferCache.size > MAX_BUFFER_CACHE) {
                    const firstKey = context.bufferCache.keys().next().value;
                    if (firstKey !== undefined) context.bufferCache.delete(firstKey);
                }

                let buffer = context.bufferCache.get(chunkId);
                if (!buffer) {
                    buffer = await context.ctx!.decodeAudioData(await blob.arrayBuffer());
                    context.bufferCache.set(chunkId, buffer);
                }

                context.workletNode?.port.postMessage({ type: 'CLEAR' });
                const pcmData = buffer.getChannelData(0);
                const startFrame = Math.floor(offset * buffer.sampleRate);
                
                context.workletNode?.port.postMessage({ 
                    type: 'PUSH_DATA', 
                    audio: startFrame > 0 ? pcmData.slice(startFrame) : pcmData,
                    immediate: true 
                });

                return { chunkId };
            }
        }
    });

    public actor = createActor(this.playbackMachine).start();

    public bind(onProgress: ProgressCallback, onEnded: EndedCallback) {
        this.onProgress = onProgress;
        this.onEnded = onEnded;
    }

    public playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        this.actor.send({ type: 'PLAY', chunkId, blob, offset });
    }

    public async queueNextChunk(chunkId: number, blob: Blob) {
        const snapshot = this.actor.getSnapshot();
        const ctx = snapshot.context.ctx;
        if (!ctx || ctx.state === 'closed') return;
        
        const cache = snapshot.context.bufferCache;
        if (!cache.has(chunkId)) {
            try {
                const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
                cache.set(chunkId, buffer);
                logger.debug('Audio', `Pre-buffered upcoming chunk ${chunkId} for gapless playback.`);
            } catch (err) {
                logger.warn('Audio', `Failed to pre-buffer chunk ${chunkId}`, err);
            }
        }
    }

    public toggle() {
        this.actor.send({ type: 'TOGGLE' });
    }

    public get state(): PlaybackState {
        return this.actor.getSnapshot().value as PlaybackState;
    }
}

export const audioPlaybackService = new AudioPlaybackService();