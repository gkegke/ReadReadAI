// [FILE: /web/src/features/studio/services/AudioPlaybackService.ts]
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
}

// [OPTIMIZATION] Max buffers to keep in memory to prevent OOM
const MAX_BUFFER_CACHE = 15;

/**
 * AudioPlaybackService (V5.1 - Iron Core + Memory Safety)
 * Uses XState to manage the Finite State Machine of Web Audio.
 */
class AudioPlaybackService {
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
        },
        states: {
            [PlaybackState.IDLE]: {
                entry: 'clearMemory', // [FIX] Clear memory when stopped
                on: {
                    PLAY: { target: PlaybackState.INITIALIZING }
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
                    onDone: {
                        target: PlaybackState.PLAYING,
                        actions: assign({ activeChunkId: ({ event }) => event.output.chunkId })
                    },
                    onError: { target: PlaybackState.ERROR }
                }
            },
            [PlaybackState.PLAYING]: {
                entry: 'resumeAudio',
                on: {
                    TOGGLE: { target: PlaybackState.PAUSED },
                    PLAY: { target: PlaybackState.BUFFERING },
                    STOP: { target: PlaybackState.IDLE },
                    ENDED: { target: PlaybackState.IDLE }
                }
            },
            [PlaybackState.PAUSED]: {
                entry: 'suspendAudio',
                on: {
                    TOGGLE: { target: PlaybackState.PLAYING },
                    PLAY: { target: PlaybackState.BUFFERING },
                    STOP: { target: PlaybackState.IDLE }
                }
            },
            [PlaybackState.ERROR]: {
                on: {
                    PLAY: { target: PlaybackState.INITIALIZING }
                }
            }
        }
    }, {
        actions: {
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
                // Keep only the most recent buffer if we are just Pausing/Idling, 
                // but if we are truly stopping, we could clear all. 
                // For now, aggressive cleanup:
                if (context.bufferCache.size > 0) {
                    logger.debug('Audio', `Clearing ${context.bufferCache.size} buffers from memory`);
                    context.bufferCache.clear();
                }
            }
        },
        actors: {
            setupAudioContext: async () => {
                // Re-use existing context if active to prevent multiple AudioContext limits in browser
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
            },
            decodeAndPush: async ({ context, event }) => {
                const { chunkId, blob, offset } = event as { chunkId: number, blob: Blob, offset?: number };
                
                // [FIX] Prune Cache
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
                const startFrame = Math.floor((offset || 0) * buffer.sampleRate);
                
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

    public toggle() {
        this.actor.send({ type: 'TOGGLE' });
    }

    public get state(): PlaybackState {
        return this.actor.getSnapshot().value as PlaybackState;
    }
}

export const audioPlaybackService = new AudioPlaybackService();