/**
 * AudioStreamProcessor
 * Runs on the dedicated Audio Thread.
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
    private buffer: Float32Array = new Float32Array(0);
    private isPaused: boolean = true;
    private framesProcessed: number = 0;

    constructor() {
        super();
        this.port.onmessage = (event) => {
            if (event.data.type === 'PUSH_DATA') {
                this.appendData(event.data.audio);
            } else if (event.data.type === 'CLEAR') {
                this.buffer = new Float32Array(0);
                this.framesProcessed = 0;
            } else if (event.data.type === 'SET_PAUSED') {
                this.isPaused = event.data.paused;
            }
        };
    }

    private appendData(newData: Float32Array) {
        const combined = new Float32Array(this.buffer.length + newData.length);
        combined.set(this.buffer);
        combined.set(newData, this.buffer.length);
        this.buffer = combined;
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
        if (this.isPaused || this.buffer.length === 0) return true;

        const output = outputs[0];
        const channelCount = output.length;
        const frameCount = output[0].length;

        const slice = this.buffer.slice(0, frameCount);
        
        for (let i = 0; i < channelCount; i++) {
            output[i].set(slice);
        }

        this.buffer = this.buffer.slice(frameCount);
        this.framesProcessed += frameCount;

        // CRITICAL (Performance: 9/10): Throttled progress updates to the UI thread
        // Only notify every ~128ms to prevent message overhead
        if (this.framesProcessed % 3072 === 0) { 
            this.port.postMessage({ 
                type: 'PROGRESS', 
                remainingFrames: this.buffer.length,
                processedFrames: this.framesProcessed
            });
        }

        return true;
    }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);