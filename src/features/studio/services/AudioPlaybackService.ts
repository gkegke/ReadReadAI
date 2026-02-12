import { useAudioStore } from '../../../shared/store/useAudioStore';
import { logger } from '../../../shared/services/Logger';
// CRITICAL: Force Vite to compile the TS processor to a JS URL
import workletUrl from '../workers/audio-processor.ts?worker&url';

/**
 * AudioPlaybackService (V2)
 * Uses AudioWorklet for un-throttleable background playback.
 */
class AudioPlaybackService {
    private ctx: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private bufferCache = new Map<number, AudioBuffer>();
    private isInitialized = false;

    private async initContext() {
        if (this.isInitialized && this.ctx?.state !== 'closed') return;
        
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'playback',
            sampleRate: 24000 // Match our model's native rate
        });

        try {
            // CRITICAL: Use the compiled URL from the import above
            await this.ctx.audioWorklet.addModule(workletUrl);

            this.workletNode = new AudioWorkletNode(this.ctx, 'audio-stream-processor');
            this.workletNode.connect(this.ctx.destination);

            this.workletNode.port.onmessage = (e) => {
                if (e.data.type === 'PROGRESS') {
                    // Future: Update global UI state based on exact worklet frame progress
                }
            };

            this.isInitialized = true;
            logger.info('Audio', 'AudioWorklet Engine Initialized');
        } catch (err) {
            logger.error('Audio', 'Worklet initialization failed', err);
            // Fallback could be implemented here (ScriptProcessorNode), 
            // but for this MVP we want to enforce Worklet usage.
        }
    }

    public async playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        await this.initContext();
        if (!this.ctx || !this.workletNode) return;

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        
        // Clear existing worklet buffer for immediate play
        this.workletNode.port.postMessage({ type: 'CLEAR' });

        try {
            const buffer = await this.decode(blob, chunkId);
            const pcmData = buffer.getChannelData(0);
            
            // Handle offset
            const startFrame = Math.floor(offset * buffer.sampleRate);
            const dataToPlay = startFrame > 0 ? pcmData.slice(startFrame) : pcmData;

            this.workletNode.port.postMessage({ 
                type: 'PUSH_DATA', 
                audio: dataToPlay 
            });
            
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: false });
            
            useAudioStore.getState().setIsPlaying(true);
            useAudioStore.getState().setActiveChunkId(chunkId);
            
            logger.debug('Audio', `Worklet play: chunk ${chunkId}`);
        } catch (e) {
            logger.error('Audio', 'Playback failed', e);
        }
    }

    public async queueNextChunk(chunkId: number, blob: Blob) {
        // Ensure context is alive before queuing
        if (!this.workletNode) await this.initContext();
        if (!this.workletNode) return;

        try {
            const buffer = await this.decode(blob, chunkId);
            const pcmData = buffer.getChannelData(0);

            // Simply push data to the end of the worklet's internal buffer
            this.workletNode.port.postMessage({ 
                type: 'PUSH_DATA', 
                audio: pcmData 
            });
            
            logger.info('Audio', `Worklet queued: chunk ${chunkId}`);
        } catch (e) {
            logger.error('Audio', 'Queue failed', e);
        }
    }

    private async decode(blob: Blob, chunkId: number): Promise<AudioBuffer> {
        if (this.bufferCache.has(chunkId)) return this.bufferCache.get(chunkId)!;
        if (!this.ctx) throw new Error("Context not ready");

        const buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer());
        
        // Cache management: keep last 10 decodes to manage memory
        if (this.bufferCache.size > 10) {
            const firstKey = this.bufferCache.keys().next().value;
            if (firstKey !== undefined) this.bufferCache.delete(firstKey);
        }
        
        this.bufferCache.set(chunkId, buffer);
        return buffer;
    }

    public async toggle() {
        if (!this.ctx || !this.workletNode) return;
        
        // We toggle the state in the Worklet to stop/start processing frames,
        // but we also suspend the Context to save battery/CPU.
        if (this.ctx.state === 'running') {
            await this.ctx.suspend();
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: true });
        } else {
            await this.ctx.resume();
            this.workletNode.port.postMessage({ type: 'SET_PAUSED', paused: false });
        }
    }
}

export const audioPlaybackService = new AudioPlaybackService();