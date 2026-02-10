/**
 * AudioEncoder Service
 * 
 * Uses WebCodecs for high-performance encoding with a simple 
 * WAV-blob fallback for maximum compatibility.
 */
export class AudioEncoderService {
    static get isSupported() {
        return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
    }

    static async encode(samples: Float32Array, sampleRate: number): Promise<Blob> {
        if (!this.isSupported) {
            console.warn("WebCodecs not supported, falling back to raw WAV encoding");
            return this.encodeWavFallback(samples, sampleRate);
        }

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            const encoder = new AudioEncoder({
                output: (chunk) => {
                    const data = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(data);
                    chunks.push(data);
                },
                error: (e) => reject(e)
            });

            try {
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
                    timestamp: 0,
                    data: samples
                });

                encoder.encode(audioData);
                encoder.flush().then(() => {
                    encoder.close();
                    resolve(new Blob(chunks, { type: 'audio/webm; codecs=opus' }));
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Simple WAV container creator for browsers without WebCodecs
     */
    private static encodeWavFallback(samples: Float32Array, sampleRate: number): Blob {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // Float to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }
}