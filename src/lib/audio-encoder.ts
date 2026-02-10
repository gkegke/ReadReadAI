import { logger } from '../services/Logger';

/**
 * AudioEncoder Service
 * Uses WebCodecs for high-performance encoding.
 * Fallback uses a standard RIFF WAVE implementation.
 */
export class AudioEncoderService {
    static get isSupported() {
        return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
    }

    static async encode(samples: Float32Array, sampleRate: number): Promise<Blob> {
        // Preferred: WebCodecs (Opus)
        if (this.isSupported) {
            try {
                return await this.encodeOpus(samples, sampleRate);
            } catch (err) {
                logger.warn('AudioEncoder', 'Opus encoding failed, falling back to WAV', err);
            }
        } else {
            logger.info('AudioEncoder', 'WebCodecs not supported, using WAV fallback.');
        }

        // Fallback: Canonical WAV
        return this.encodeWav(samples, sampleRate);
    }

    private static async encodeOpus(samples: Float32Array, sampleRate: number): Promise<Blob> {
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
        });
    }

    /**
     * Standard RIFF WAVE Encoding (Linear PCM 16-bit)
     * Follows the canonical spec to ensure maximum compatibility.
     */
    private static encodeWav(samples: Float32Array, sampleRate: number): Blob {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true); // file length - 8
        this.writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);       // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true);        // AudioFormat (1 = PCM)
        view.setUint16(22, 1, true);        // NumChannels (1 = Mono)
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * BlockAlign)
        view.setUint16(32, 2, true);        // BlockAlign (NumChannels * BitsPerSample/8)
        view.setUint16(34, 16, true);       // BitsPerSample

        // data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true); // Subchunk2Size

        // Write PCM samples (Float32 -> Int16)
        this.floatTo16BitPCM(view, 44, samples);

        return new Blob([view], { type: 'audio/wav' });
    }

    private static writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    private static floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            // Clamp to [-1, 1]
            let s = Math.max(-1, Math.min(1, input[i]));
            // Scale to 16-bit signed integer range
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            output.setInt16(offset, s, true);
        }
    }
}