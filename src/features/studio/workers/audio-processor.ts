// Define the AudioWorkletGlobalScope types which are not in standard lib.dom.d.ts
interface AudioWorkletProcessor {
    readonly port: MessagePort;
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

declare var registerProcessor: (name: string, processorCtor: (new (options?: any) => AudioWorkletProcessor)) => void;
declare var AudioWorkletProcessor: {
    prototype: AudioWorkletProcessor;
    new (options?: any): AudioWorkletProcessor;
};

/**
 * AudioStreamProcessor (Phase 2)
 * Handles ring-buffer of PCM data with gapless transitions.
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
    private buffer: Float32Array = new Float32Array(0);
    private isPaused: boolean = true;
    private framesProcessed: number = 0;
    private totalFramesEverPushed: number = 0;

    constructor() {
        super();
        this.port.onmessage = (event) => {
            const { type, audio, paused } = event.data;

            if (type === 'PUSH_DATA') {
                this.appendData(audio);
            } else if (type === 'CLEAR') {
                this.buffer = new Float32Array(0);
                this.framesProcessed = 0;
                this.totalFramesEverPushed = 0;
            } else if (type === 'SET_PAUSED') {
                this.isPaused = paused;
            }
        };
    }

    private appendData(newData: Float32Array) {
        const combined = new Float32Array(this.buffer.length + newData.length);
        combined.set(this.buffer);
        combined.set(newData, this.buffer.length);
        this.buffer = combined;
        this.totalFramesEverPushed += newData.length;
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const output = outputs[0];
        const channelCount = output.length;
        const frameCount = output[0].length;

        if (this.isPaused || this.buffer.length === 0) {
            // Fill with silence if no data
            for (let i = 0; i < channelCount; i++) output[i].fill(0);
            return true;
        }

        const slice = this.buffer.slice(0, frameCount);
        
        for (let i = 0; i < channelCount; i++) {
            output[i].set(slice);
            // If the buffer was shorter than frameCount, fill the rest with 0
            if (slice.length < frameCount) {
                output[i].fill(0, slice.length);
            }
        }

        this.buffer = this.buffer.slice(frameCount);
        this.framesProcessed += frameCount;

        // Throttled progress update (approx every 100ms)
        if (this.framesProcessed % 2400 === 0) { 
            this.port.postMessage({ 
                type: 'PROGRESS', 
                processedFrames: this.framesProcessed,
                totalFrames: this.totalFramesEverPushed 
            });
        }

        // Notify if we run out of data
        if (this.buffer.length === 0 && !this.isPaused) {
            this.port.postMessage({ type: 'ENDED' });
        }

        return true;
    }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);