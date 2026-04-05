import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { logger } from '../services/Logger';

/**
 * AudioEncoder Service
 * Handles fast internal WAV wrapping and compressed Opus export.
 */
export class AudioEncoderService {
    static get isWebCodecsSupported() {
        return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
    }

    static encodeWav(samples: Float32Array, sampleRate: number): Blob {
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
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        for (let i = 0; i < samples.length; i++) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    /**
     * Heavyweight Opus encoding for external export.
     */
    static async encodeToOpus(wavBlob: Blob): Promise<Blob> {
        if (!this.isWebCodecsSupported) {
            logger.warn('AudioEncoder', 'WebCodecs not supported, returning raw WAV');
            return wavBlob;
        }

        try {
            // Setup decoding of internal WAV
            const audioCtx = new OfflineAudioContext(1, 1, 48000);
            const audioBuffer = await audioCtx.decodeAudioData(await wavBlob.arrayBuffer());
            const samples = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: undefined,
                audio: {
                    codec: 'A_OPUS',
                    sampleRate: sampleRate,
                    numberOfChannels: 1,
                },
            });

            const encoder = new AudioEncoder({
                output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
                error: (e) => logger.error('AudioEncoder', 'Opus Encoding Error', e)
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
            logger.error('AudioEncoder', 'Opus compression failed', err);
            return wavBlob;
        }
    }
}
