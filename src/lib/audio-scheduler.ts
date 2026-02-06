/**
 * Web Audio API based Scheduler.
 * 
 * Provides:
 * 1. Gapless Playback (Sequencing AudioBuffers)
 * 2. Accurate Timing
 * 3. Pitch-preserving playback rate (via AudioContext mechanics, though PitchShift is separate)
 */
export class AudioScheduler {
    private ctx: AudioContext;
    private nextStartTime: number = 0;
    private isPlaying: boolean = false;
    
    // Track active nodes to stop them
    private activeSource: AudioBufferSourceNode | null = null;
    
    // Callback hooks
    private onTimeUpdate: ((currentTime: number) => void) | null = null;
    private onEnded: (() => void) | null = null;
    
    // State tracking
    private currentPlaybackSpeed: number = 1.0;
    private startTimestamp: number = 0; // Context time when playback started/resumed
    private elapsedWhenPaused: number = 0; // Time already played before pause
    private animationFrameId: number | null = null;

    constructor() {
        // Initialize AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
    }

    public async resumeContext() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Decodes binary data into an AudioBuffer.
     * This is CPU intensive, so it should be done just-in-time or cached carefully.
     */
    private async decode(blob: Blob): Promise<AudioBuffer> {
        const arrayBuffer = await blob.arrayBuffer();
        return await this.ctx.decodeAudioData(arrayBuffer);
    }

    /**
     * Plays a blob immediately, clearing any previous schedule.
     */
    public async playImmediate(blob: Blob, speed: number = 1.0) {
        await this.resumeContext();
        this.stop(); // Clear previous

        try {
            const buffer = await this.decode(blob);
            this.currentPlaybackSpeed = speed;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = speed;
            source.connect(this.ctx.destination);

            // Schedule
            const now = this.ctx.currentTime;
            this.nextStartTime = now + buffer.duration / speed; // Track expected end
            this.startTimestamp = now;
            this.elapsedWhenPaused = 0;

            source.start(now);
            
            this.activeSource = source;
            this.isPlaying = true;

            // Handle completion
            source.onended = () => {
                if (this.isPlaying && this.activeSource === source) {
                    // Only trigger if we naturally finished, not if we were stopped
                    if (this.onEnded) this.onEnded();
                }
            };

            this.startLoop();

        } catch (e) {
            console.error("Audio Decode Error:", e);
            if (this.onEnded) this.onEnded(); // Skip broken chunks
        }
    }

    /**
     * Web Audio API doesn't have a built-in "currentTime" for a specific source like the HTML tag.
     * We have to calculate it.
     */
    private startLoop() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        const tick = () => {
            if (!this.isPlaying) return;

            const now = this.ctx.currentTime;
            // Calculate progress based on how long we've been running * speed
            // This is a simplification; precise tracking requires tracking startOffset
            const rawElapsed = (now - this.startTimestamp) * this.currentPlaybackSpeed;
            const current = rawElapsed + this.elapsedWhenPaused;

            if (this.onTimeUpdate) {
                // Clamp to buffer duration if we had access to it, 
                // but for now relying on logic to not exceed visual bounds
                this.onTimeUpdate(current);
            }

            this.animationFrameId = requestAnimationFrame(tick);
        };
        tick();
    }

    public stop() {
        this.isPlaying = false;
        if (this.activeSource) {
            try { this.activeSource.stop(); } catch(e) { /* ignore already stopped */ }
            this.activeSource.disconnect();
            this.activeSource = null;
        }
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }

    public setSpeed(speed: number) {
        this.currentPlaybackSpeed = speed;
        if (this.activeSource) {
            // Note: Changing speed mid-stream in Web Audio shifts pitch unless
            // using a specialized phase vocoder. For standard SourceNodes, it acts like a tape deck.
            // Users usually accept this or stop/start.
            // For MVP, we apply it to the active node.
            this.activeSource.playbackRate.setValueAtTime(speed, this.ctx.currentTime);
        }
    }

    public setHandlers(onEnded: () => void, onTimeUpdate: (t: number) => void) {
        this.onEnded = onEnded;
        this.onTimeUpdate = onTimeUpdate;
    }

    public destroy() {
        this.stop();
        this.ctx.close();
    }
}