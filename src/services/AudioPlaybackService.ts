import { useAudioStore } from '../store/useAudioStore';

class AudioPlaybackService {
    private audio: HTMLAudioElement;
    private currentChunkId: number | null = null;
    private currentBlobUrl: string | null = null;

    constructor() {
        this.audio = new Audio();
        this.audio.preload = 'auto'; 
        this.setupListeners();
    }

    private setupListeners() {
        this.audio.ontimeupdate = () => {
            useAudioStore.getState().setTime(this.audio.currentTime, this.audio.duration || 0);
        };

        this.audio.onplay = () => useAudioStore.getState().setIsPlaying(true);
        this.audio.onpause = () => useAudioStore.getState().setIsPlaying(false);
        this.audio.onended = () => {
            useAudioStore.getState().setIsPlaying(false);
            useAudioStore.getState().playNext();
        };
        
        this.audio.onerror = (e) => {
            console.error("[AudioPlayback] Element Error:", e);
            useAudioStore.getState().setIsPlaying(false);
        };
    }

    public async playChunk(chunkId: number, blob: Blob, startTime: number = 0, autoPlay: boolean = true) {
        const store = useAudioStore.getState();

        // If same chunk, just handle play/pause/seek
        if (this.currentChunkId === chunkId && this.currentBlobUrl) {
            if (Math.abs(this.audio.currentTime - startTime) > 0.1) {
                this.audio.currentTime = startTime;
            }
            if (autoPlay && this.audio.paused) {
                await this.audio.play().catch(e => console.warn("Autoplay blocked", e));
            }
            return;
        }

        // Clean up previous URL to prevent memory leaks
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }

        this.currentChunkId = chunkId;
        this.currentBlobUrl = URL.createObjectURL(blob);
        
        this.audio.src = this.currentBlobUrl;
        this.audio.playbackRate = store.playbackSpeed;
        this.audio.currentTime = startTime;

        if (autoPlay) {
            try {
                await this.audio.play();
            } catch (e) {
                console.warn("[AudioPlayback] Play interrupted or blocked:", e);
            }
        }
    }

    public toggle() {
        if (this.audio.paused && this.audio.src) {
            this.audio.play().catch(() => {});
        } else {
            this.audio.pause();
        }
    }

    public seek(time: number) {
        if (isFinite(time) && this.audio.duration) {
            this.audio.currentTime = time;
        }
    }

    public setSpeed(speed: number) {
        this.audio.playbackRate = speed;
    }

    public stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        this.currentChunkId = null;
    }
}

export const audioPlaybackService = new AudioPlaybackService();