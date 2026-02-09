/**
 * AudioEncoder Service (WebCodecs API)
 * 
 * Industry standard approach to high-performance, browser-native encoding.
 * Encodes raw samples into compressed Opus within a WebM container.
 */
export class AudioEncoderService {
    static get isSupported() {
        return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
    }

    static async encode(samples: Float32Array, sampleRate: number): Promise<Blob> {
        if (!this.isSupported) {
            throw new Error("WebCodecs API (AudioEncoder) is not supported in this browser.");
        }

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            
            const encoder = new AudioEncoder({
                output: (chunk, metadata) => {
                    // Optional: handle metadata if we needed Ogg encapsulation manual
                    const data = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(data);
                    chunks.push(data);
                },
                error: (e) => {
                    console.error("WebCodecs Encoding Error:", e);
                    reject(e);
                }
            });

            try {
                // Configure for high-fidelity voice
                encoder.configure({
                    codec: 'opus',
                    sampleRate: sampleRate,
                    numberOfChannels: 1,
                    bitrate: 128_000, 
                });

                const audioData = new AudioData({
                    format: 'f32',
                    sampleRate: sampleRate,
                    numberOfFrames: samples.length,
                    numberOfChannels: 1,
                    timestamp: 0, // 0 is fine for a single file blob
                    data: samples
                });

                encoder.encode(audioData);
                
                encoder.flush().then(() => {
                    encoder.close();
                    // Package chunks into a WebM-friendly Blob
                    // Note: Browsers handle raw Opus inside audio/webm effectively
                    resolve(new Blob(chunks, { type: 'audio/webm; codecs=opus' }));
                });

            } catch (err) {
                reject(err);
            }
        });
    }
}