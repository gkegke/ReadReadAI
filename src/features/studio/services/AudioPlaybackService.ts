import { useAudioStore } from '../../../shared/store/useAudioStore';
import { logger } from '../../../shared/services/Logger';

/**
 * AudioPlaybackService
 * Optimized with high-resolution scheduling and telemetry.
 */
class AudioPlaybackService {
    private ctx: AudioContext | null = null;
    private schedule: Array<{ chunkId: number, startTime: number, duration: number, source: AudioBufferSourceNode }> = [];
    private nextScheduleTime: number = 0;
    private bufferCache = new Map<number, AudioBuffer>();

    private get context(): AudioContext {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            logger.info('Audio', 'AudioContext Initialized');
        }
        return this.ctx;
    }

    constructor() {
        this.startMonitor();
    }

    private startMonitor() {
        const tick = () => {
            if (this.ctx?.state === 'running') {
                const now = this.ctx.currentTime;
                const active = this.schedule.find(s => now >= s.startTime && now < s.startTime + s.duration);
                
                if (active) {
                    const store = useAudioStore.getState();
                    if (store.activeChunkId !== active.chunkId) store.setActiveChunkId(active.chunkId);
                    store.setTime(now - active.startTime, active.duration);
                }
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

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
            
            this.schedule.push({ chunkId, startTime: now - offset, duration: buffer.duration, source });
            this.nextScheduleTime = now + (buffer.duration - offset);
            useAudioStore.getState().setIsPlaying(true);
            
            logger.debug('Audio', `Immediate play: chunk ${chunkId}`);
        } catch (e) {
            logger.error('Audio', 'Playback failed', e);
        }
    }

    public async queueNextChunk(chunkId: number, blob: Blob) {
        if (this.schedule.some(s => s.chunkId === chunkId)) return;

        try {
            const buffer = await this.decode(blob, chunkId);
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.context.destination);

            if (this.nextScheduleTime < this.context.currentTime) {
                this.nextScheduleTime = this.context.currentTime;
            }

            source.start(this.nextScheduleTime);
            this.schedule.push({ chunkId, startTime: this.nextScheduleTime, duration: buffer.duration, source });
            this.nextScheduleTime += buffer.duration;
            
            logger.info('Audio', `Gapless queue: chunk ${chunkId}`);
        } catch (e) {
            logger.error('Audio', 'Queue failed', e);
        }
    }

    private async decode(blob: Blob, chunkId: number): Promise<AudioBuffer> {
        if (this.bufferCache.has(chunkId)) return this.bufferCache.get(chunkId)!;
        const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
        if (this.bufferCache.size > 20) this.bufferCache.clear();
        this.bufferCache.set(chunkId, buffer);
        return buffer;
    }

    public toggle() {
        if (this.context.state === 'running') this.context.suspend();
        else this.context.resume();
    }

    private clearSchedule() {
        this.schedule.forEach(s => { try { s.source.stop(); s.source.disconnect(); } catch {} });
        this.schedule = [];
    }
}

export const audioPlaybackService = new AudioPlaybackService();