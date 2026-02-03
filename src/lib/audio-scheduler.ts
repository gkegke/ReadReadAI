/**
 * AudioScheduler
 * 
 * Handles Gapless Playback via double-buffering.
 */

type PlaybackState = 'stopped' | 'playing' | 'paused';

export class AudioScheduler {
    private primary: HTMLAudioElement;
    private secondary: HTMLAudioElement;
    
    private _primaryHash: string | null = null;
    private _secondaryHash: string | null = null;

    private state: PlaybackState = 'stopped';
    
    private onEnded: (() => void) | null = null;
    private onTimeUpdate: ((t: number, d: number) => void) | null = null;

    constructor() {
        this.primary = new Audio();
        this.secondary = new Audio();
        
        this.primary.addEventListener('ended', () => {
            if (this.trySwap()) {
                if (this.onEnded) this.onEnded();
            } else {
                this.state = 'stopped';
                if (this.onEnded) this.onEnded();
            }
        });

        this.primary.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.primary.currentTime, this.primary.duration || 0);
            }
        });
    }

    /**
     * Public getter to allow external synchronization without hacks.
     */
    public get activeHash(): string | null {
        return this._primaryHash;
    }

    public async playImmediate(blob: Blob, hash: string, speed: number) {
        const url = URL.createObjectURL(blob);
        this._secondaryHash = null; 
        
        this.primary.src = url;
        this._primaryHash = hash;
        this.primary.playbackRate = speed;
        
        await this.primary.play();
        this.state = 'playing';
    }

    public preloadNext(blob: Blob, hash: string) {
        if (this._secondaryHash === hash) return; 

        const url = URL.createObjectURL(blob);
        this.secondary.src = url;
        this.secondary.preload = 'auto';
        this.secondary.load(); 
        this._secondaryHash = hash;
    }

    private trySwap(): boolean {
        if (this._secondaryHash && this.secondary.readyState >= 2) {
            const tempInfo = { el: this.primary, hash: this._primaryHash };
            
            this.primary = this.secondary;
            this._primaryHash = this._secondaryHash;
            
            this.secondary = tempInfo.el;
            this._secondaryHash = null;

            this.primary.onended = () => {
                if (this.trySwap()) {
                   if (this.onEnded) this.onEnded();
                } else {
                   this.state = 'stopped';
                   if (this.onEnded) this.onEnded();
                }
            };
            
            this.primary.ontimeupdate = () => {
                if (this.onTimeUpdate) {
                    this.onTimeUpdate(this.primary.currentTime, this.primary.duration || 0);
                }
            };

            const speed = this.secondary.playbackRate;
            this.primary.playbackRate = speed;
            this.primary.play();
            
            return true;
        }
        return false;
    }

    public pause() {
        this.primary.pause();
        this.state = 'paused';
    }

    public resume() {
        if (this.primary.src) {
            this.primary.play();
            this.state = 'playing';
        }
    }

    public setSpeed(speed: number) {
        this.primary.playbackRate = speed;
        this.secondary.playbackRate = speed;
    }

    public setHandlers(onEnded: () => void, onTimeUpdate: (t: number, d: number) => void) {
        this.onEnded = onEnded;
        this.onTimeUpdate = onTimeUpdate;
    }

    public destroy() {
        this.primary.pause();
        this.primary.src = '';
        this.secondary.pause();
        this.secondary.src = '';
    }
}