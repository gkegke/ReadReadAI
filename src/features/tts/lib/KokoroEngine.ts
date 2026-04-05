import { TTSEngine, type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';
import { logger } from '../../../shared/services/Logger';

/**
 * KokoroEngine
 * Supports dynamic dtypes (q8, fp16, etc)
 */
export class KokoroEngine extends TTSEngine {
    private tts: any = null;

    async init(config?: { dtype: string }): Promise<void> {
        const { KokoroTTS } = await import('kokoro-js');

        const dtype = config?.dtype || 'q8';
        logger.info('KokoroEngine', `Initializing with precision: ${dtype}`);

        this.tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
            dtype: (dtype === 'base' ? undefined : dtype) as any,
        });
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        if (!this.tts) throw new Error("Kokoro Engine not initialized");

        const result = await this.tts.generate(text, {
            voice: config.voice,
            speed: config.speed
        });

        return {
            audio: result.audio,
            sampleRate: result.sampling_rate || 24000
        };
    }

    getVoices() {
        return [
            { id: 'af_heart', name: 'HEART (US)' },
            { id: 'af_bella', name: 'BELLA (US)' },
            { id: 'af_sarah', name: 'SARAH (US)' },
            { id: 'am_adam', name: 'ADAM (US)' },
            { id: 'am_echo', name: 'ECHO (US)' },
            { id: 'bf_emma', name: 'EMMA (UK)' },
            { id: 'bf_isabella', name: 'ISABELLA (UK)' }
        ];
    }
}
