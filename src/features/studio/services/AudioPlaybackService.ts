import { logger } from '../../../shared/services/Logger';

export enum PlaybackState {
    IDLE = 'IDLE',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED'
}

interface AudioChannel {
    audio: HTMLAudioElement;
    url: string | null;
    hash: string | null;
}

export class AudioPlaybackService {
    // [OPTIMIZATION: GAPLESS PLAYBACK]
    // Double-buffering architecture. While one audio element plays,
    // the inactive one can decode the next file in the background.
    private channels: AudioChannel[] = [
        { audio: new Audio(), url: null, hash: null },
        { audio: new Audio(), url: null, hash: null }
    ];
    private activeIndex = 0;

    private get active() { return this.channels[this.activeIndex]; }
    private get inactive() { return this.channels[1 - this.activeIndex]; }

    // Callbacks
    private onEnded: (() => void) | null = null;
    private onProgress: ((current: number, total: number) => void) | null = null;
    private onStateChange: ((state: PlaybackState) => void) | null = null;

    constructor() {
        // Attach identical listeners to both channels, but strictly gate their
        // dispatches so the UI only reacts to the currently active channel.
        this.channels.forEach((channel, index) => {
            const { audio } = channel;

            audio.addEventListener('timeupdate', () => {
                if (this.activeIndex === index && this.onProgress && audio.duration) {
                    this.onProgress(audio.currentTime, audio.duration);
                }
            });

            audio.addEventListener('ended', () => {
                if (this.activeIndex === index) {
                    this.onStateChange?.(PlaybackState.IDLE);
                    this.onEnded?.();
                }
            });

            audio.addEventListener('play', () => {
                if (this.activeIndex === index) {
                    this.onStateChange?.(PlaybackState.PLAYING);
                }
            });

            audio.addEventListener('pause', () => {
                if (this.activeIndex === index && !audio.ended) {
                    this.onStateChange?.(PlaybackState.PAUSED);
                }
            });
        });
    }

    public bind(
        onProgress: (c: number, d: number) => void,
        onEnded: () => void,
        onStateChange: (state: PlaybackState) => void
    ) {
        this.onProgress = onProgress;
        this.onEnded = onEnded;
        this.onStateChange = onStateChange;
    }

    public initContext() {
        // Preserved for interface compatibility
    }

    public async playChunk(hash: string, blob: Blob, rate: number = 1.0) {
        try {
            if (blob.size === 0) throw new Error("Empty audio blob");

            // SCENARIO A: The exact chunk we want was preloaded into the inactive channel!
            // We just swap the active index and hit play. Instantaneous playback.
            if (this.inactive.hash === hash) {
                this.active.audio.pause();
                this.activeIndex = 1 - this.activeIndex;

                // Re-assert both speed properties to override browser defaults
                this.active.audio.defaultPlaybackRate = rate;
                this.active.audio.playbackRate = rate;

                await this.active.audio.play();
                return;
            }

            // SCENARIO B: User restarted the currently active chunk.
            if (this.active.hash === hash && this.active.url) {
                this.active.audio.currentTime = 0;
                this.active.audio.defaultPlaybackRate = rate;
                this.active.audio.playbackRate = rate;
                await this.active.audio.play();
                return;
            }

            // SCENARIO C: Cache miss (user jumped to a random point). Load normally.
            this.active.audio.pause();

            if (this.active.url) URL.revokeObjectURL(this.active.url);
            this.active.url = URL.createObjectURL(blob);
            this.active.hash = hash;

            this.active.audio.src = this.active.url;

            // Hard apply rate bounds
            this.active.audio.defaultPlaybackRate = rate;
            this.active.audio.playbackRate = rate;

            this.active.audio.load();
            await this.active.audio.play();

        } catch (e) {
            logger.error('AudioPlayback', 'Failed to play HTML audio', e);
            this.stop();
        }
    }

    /**
     * [OPTIMIZATION] Loads a blob into the background audio element so the
     * browser can decode the file while the current chunk is still playing.
     */
    public preloadChunk(hash: string, blob: Blob) {
        try {
            if (this.inactive.hash === hash) return; // Already ready
            if (this.active.hash === hash) return;   // Currently playing

            if (this.inactive.url) URL.revokeObjectURL(this.inactive.url);

            this.inactive.url = URL.createObjectURL(blob);
            this.inactive.hash = hash;

            this.inactive.audio.src = this.inactive.url;
            this.inactive.audio.load(); // Forces background metadata parse/decode
        } catch (e) {
            logger.warn('AudioPlayback', 'Failed to preload chunk', e);
        }
    }

    public setRate(rate: number) {
        this.active.audio.defaultPlaybackRate = rate;
        this.active.audio.playbackRate = rate;
    }

    public toggle() {
        if (this.active.audio.paused) {
            if (this.active.audio.src) this.active.audio.play();
        } else {
            this.active.audio.pause();
        }
    }

    public stop() {
        this.active.audio.pause();
        this.active.audio.currentTime = 0;
        this.onStateChange?.(PlaybackState.IDLE);
    }

    public clearBufferCache() {
        this.channels.forEach(channel => {
            if (channel.url) {
                URL.revokeObjectURL(channel.url);
                channel.url = null;
                channel.hash = null;
            }
        });
    }
}

export const audioPlaybackService = new AudioPlaybackService();
