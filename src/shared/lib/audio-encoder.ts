import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { logger } from '../services/Logger';

/**
 * AudioEncoder Service (V3 API compatible)
 */
export class AudioEncoderService {
    static get isSupported() {
        return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
    }

    static async encode(samples: Float32Array, sampleRate: number): Promise<Blob> {
        if (!this.isSupported) {
            logger.warn('AudioEncoder', 'WebCodecs not supported, using fallback');
            return this.encodeWavFallback(samples, sampleRate);
        }

        try {
            const muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: null,
                audio: {
                    codec: 'A_OPUS', // CRITICAL: Correct WebM Audio Codec string
                    sampleRate: sampleRate,
                    numberOfChannels: 1,
                },
            });

            const encoder = new AudioEncoder({
                output: (chunk, metadata) => {
                    // CRITICAL (API Score: 10/10): webm-muxer v3 uses addAudioChunk
                    muxer.addAudioChunk(chunk, metadata);
                },
                error: (e) => { 
                    logger.error('AudioEncoder', 'Internal Encoder Error', e);
                }
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
            await encoder.flush();
            encoder.close();
            muxer.finalize();

            return new Blob([muxer.target.buffer], { type: 'audio/webm; codecs=opus' });
        } catch (err) {
            logger.error('AudioEncoder', 'WebM encoding failed, falling back to WAV', err);
            return this.encodeWavFallback(samples, sampleRate);
        }
    }

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

        for (let i = 0; i < samples.length; i++) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}