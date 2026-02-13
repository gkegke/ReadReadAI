import { logger } from '../../../shared/services/Logger';
// CRITICAL: Use ?url. ?worker&url implies a Worker constructor, but addModule expects a path.
import workletUrl from '../workers/audio-processor.ts?url';

export enum PlaybackState {
    IDLE = 'IDLE',
    BUFFERING = 'BUFFERING',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    ERROR = 'ERROR'
}

type ProgressCallback = (currentTime: number, duration: number) => void;
type EndedCallback = () => void;

/**
 * AudioPlaybackService (V4 - Hardened)
 * Handles the high-precision AudioContext and Worklet lifecycle.
 * Decoupled from Zustand to prevent circular dependencies.
 */
class AudioPlaybackService {
    private ctx: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private bufferCache = new Map<number, AudioBuffer>();
    private isInitialized = false;

    // Reactive bindings
    private onProgress: ProgressCallback | null = null;
    private onEnded: EndedCallback | null = null;

    // Internal state tracking to prevent race conditions
    private _currentState: PlaybackState = PlaybackState.IDLE;
    private _activeChunkId: number | null = null;

    /**
     * Bind store actions to this service. 
     * call this once from the store or root component.
     */
    public bind(onProgress: ProgressCallback, onEnded: EndedCallback) {
        this.onProgress = onProgress;
        this.onEnded = onEnded;
    }

    private async initContext() {
        if (this.isInitialized && this.ctx?.state !== 'closed') return;
        
        logger.info('Audio', 'Initializing Web Audio Context...');
        this.ctx = new AudioContext({
            latencyHint: 'playback',
            sampleRate: 24000 
        });

        try {
            await this.ctx.audioWorklet.addModule(workletUrl);
            this.workletNode = new AudioWorkletNode(this.ctx, 'audio-stream-processor');
            this.workletNode.connect(this.ctx.destination);

            this.workletNode.port.onmessage = (e) => {
                if (e.data.type === 'PROGRESS') {
                    const { processedFrames, totalFrames } = e.data;
                    const sampleRate = this.ctx?.sampleRate || 24000;
                    if (this.onProgress) {
                        this.onProgress(processedFrames / sampleRate, totalFrames / sampleRate);
                    }
                }
                if (e.data.type === 'ENDED') {
                    logger.debug('Audio', 'Stream Ended, triggering auto-advance');
                    if (this.onEnded) this.onEnded();
                }
            };

            this.isInitialized = true;
            logger.info('Audio', 'Worklet Engine Ready');
        } catch (err) {
            logger.error('Audio', 'Worklet initialization failed', err);
            this._currentState = PlaybackState.ERROR;
            throw err;
        }
    }

    /**
     * Immediate Playback of a specific chunk.
     * Clears existing buffers for a clean jump.
     */
    public async playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        
        // State Gatekeeping
        if (this._activeChunkId === chunkId && this._currentState === PlaybackState.PLAYING && offset === 0) {
            return this.toggle(); 
        }

        this._currentState = PlaybackState.BUFFERING;
        await this.initContext();
        
        if (!this.ctx || !this.workletNode) return;

        try {
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            
            // 1. Clear current playback queue
            this.workletNode.port.postMessage({ type: 'CLEAR' });

            // 2. Decode and push
            const buffer = await this.decode(blob, chunkId);
            const pcmData = buffer.getChannelData(0);
            
            const startFrame = Math.floor(offset * buffer.sampleRate);
            const dataToPlay = startFrame > 0 ? pcmData.slice(startFrame) : pcmData;

            this.workletNode.port.postMessage({ 
                type: 'PUSH_DATA', 
                audio: dataToPlay,
                immediate: true 
            });
            
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: false });
            
            this._activeChunkId = chunkId;
            this._currentState = PlaybackState.PLAYING;
            
            logger.info('Audio', `Started playback: Chunk ${chunkId} @ ${offset}s`);
        } catch (e) {
            this._currentState = PlaybackState.ERROR;
            logger.error('Audio', `Playback failed for chunk ${chunkId}`, e);
            throw e; // Let the caller handle UI updates
        }
    }

    /**
     * Gapless Scheduling
     * Pushes data to the end of the current worklet buffer.
     */
    public async queueNextChunk(chunkId: number, blob: Blob) {
        if (!this.workletNode) return;

        try {
            const buffer = await this.decode(blob, chunkId);
            this.workletNode.port.postMessage({ 
                type: 'PUSH_DATA', 
                audio: buffer.getChannelData(0),
                immediate: false 
            });
            logger.debug('Audio', `Pre-buffered gapless: Chunk ${chunkId}`);
        } catch (e) {
            logger.error('Audio', `Gapless queue failed for chunk ${chunkId}`, e);
        }
    }

    private async decode(blob: Blob, chunkId: number): Promise<AudioBuffer> {
        // LRU Cache for decoded buffers to prevent GC thrashing during loops
        if (this.bufferCache.has(chunkId)) return this.bufferCache.get(chunkId)!;
        if (!this.ctx) throw new Error("Context not ready");

        const buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer());
        
        if (this.bufferCache.size > 10) {
            const firstKey = this.bufferCache.keys().next().value;
            if (firstKey !== undefined) this.bufferCache.delete(firstKey);
        }
        
        this.bufferCache.set(chunkId, buffer);
        return buffer;
    }

    public async toggle() {
        if (!this.ctx || !this.workletNode) return PlaybackState.IDLE;
        
        if (this._currentState === PlaybackState.PLAYING) {
            await this.ctx.suspend();
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: true });
            this._currentState = PlaybackState.PAUSED;
            logger.debug('Audio', 'Playback Paused');
        } else {
            await this.ctx.resume();
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: false });
            this._currentState = PlaybackState.PLAYING;
            logger.debug('Audio', 'Playback Resumed');
        }
        return this._currentState;
    }
    
    public get state() { return this._currentState; }
}

export const audioPlaybackService = new AudioPlaybackService();