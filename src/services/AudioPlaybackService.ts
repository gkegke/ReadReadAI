import { useAudioStore } from '../store/useAudioStore';
import { logger } from './Logger';

interface ScheduledChunk {
    chunkId: number;
    startTime: number;
    duration: number;
    source: AudioBufferSourceNode;
}

/**
 * AudioPlaybackService (V2)
 * CRITICAL: Pivot to sample-accurate Look-ahead Scheduling.
 * This service decoupling playback from the browser's HTMLAudio element to 
 * ensure true gapless transitions between synthesized chunks.
 */
class AudioPlaybackService {
    private ctx: AudioContext | null = null;
    private schedule: ScheduledChunk[] = [];
    private nextScheduleTime: number = 0;
    private monitorId: number | null = null;
    private bufferCache = new Map<number, AudioBuffer>();

    private get context(): AudioContext {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.ctx;
    }

    constructor() {
        this.startMonitor();
    }

    private startMonitor() {
        const tick = () => {
            if (this.ctx && this.ctx.state === 'running') {
                const now = this.ctx.currentTime;
                // Find the chunk currently playing according to the AudioContext clock
                const active = this.schedule.find(s => now >= s.startTime && now < s.startTime + s.duration);
                
                if (active) {
                    const store = useAudioStore.getState();
                    if (store.activeChunkId !== active.chunkId) {
                        store.setActiveChunkId(active.chunkId);
                    }
                    store.setTime(now - active.startTime, active.duration);
                } else if (this.schedule.length > 0 && now > this.schedule[this.schedule.length - 1].startTime + this.schedule[this.schedule.length - 1].duration) {
                    this.stop();
                    useAudioStore.getState().setIsPlaying(false);
                }
            }
            this.monitorId = requestAnimationFrame(tick);
        };
        this.monitorId = requestAnimationFrame(tick);
    }

    private async decode(blob: Blob, chunkId: number): Promise<AudioBuffer> {
        if (this.bufferCache.has(chunkId)) return this.bufferCache.get(chunkId)!;
        
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await this.context.decodeAudioData(arrayBuffer);
        
        // Cache management: Keep only the most recent few buffers
        if (this.bufferCache.size > 10) this.bufferCache.clear();
        this.bufferCache.set(chunkId, buffer);
        
        return buffer;
    }

    /**
     * Immediate playback with optional seek offset
     */
    public async playChunk(chunkId: number, blob: Blob, offset: number = 0) {
        await this.context.resume();
        this.clearSchedule();

        try {
            const buffer = await this.decode(blob, chunkId);
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);
            
            const now = this.context.currentTime;
            source.start(now, offset);
            
            this.schedule.push({
                chunkId,
                startTime: now - offset,
                duration: buffer.duration,
                source
            });

            this.nextScheduleTime = now + (buffer.duration - offset);
            useAudioStore.getState().setIsPlaying(true);
            logger.debug('AudioPlayback', `Started playback for chunk ${chunkId}`);
        } catch (e) {
            logger.error('AudioPlayback', 'Failed to play chunk', e);
        }
    }

    /**
     * CRITICAL: Gapless Scheduling logic.
     * Queues the next chunk to start precisely when the current one ends.
     */
    public async queueNextChunk(chunkId: number, blob: Blob) {
        if (this.schedule.some(s => s.chunkId === chunkId)) return;

        try {
            const buffer = await this.decode(blob, chunkId);
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);

            // If we've fallen behind, start from now
            if (this.nextScheduleTime < this.context.currentTime) {
                this.nextScheduleTime = this.context.currentTime;
            }

            source.start(this.nextScheduleTime);
            
            this.schedule.push({
                chunkId,
                startTime: this.nextScheduleTime,
                duration: buffer.duration,
                source
            });

            this.nextScheduleTime += buffer.duration;
            logger.debug('AudioPlayback', `Scheduled gapless transition to chunk ${chunkId}`);
        } catch (e) {
            logger.error('AudioPlayback', 'Failed to queue next chunk', e);
        }
    }

    public toggle() {
        if (this.context.state === 'running') this.context.suspend();
        else this.context.resume();
    }

    public stop() {
        this.clearSchedule();
        this.nextScheduleTime = 0;
        this.bufferCache.clear();
    }

    private clearSchedule() {
        this.schedule.forEach(s => {
            try { s.source.stop(); s.source.disconnect(); } catch (e) {}
        });
        this.schedule = [];
    }
}

export const audioPlaybackService = new AudioPlaybackService();