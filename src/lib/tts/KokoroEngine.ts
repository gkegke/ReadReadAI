import { TTSEngine, type AudioResult } from './types';
import type { ModelConfig } from '../../types/tts';

/**
 * KokoroEngine
 * Refactored to use kokoro-js (Standard high-level wrapper).
 */
export class KokoroEngine extends TTSEngine {
    private tts: any = null;

    async init(): Promise<void> {
        const { KokoroTTS } = await import('kokoro-js');
        
        // Load the 82M parameter model (quantized for browser performance)
        this.tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
            dtype: "q8", // 8-bit quantization for mobile/mid-end devices
        });
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        if (!this.tts) throw new Error("Kokoro Engine not initialized");

        // The high-level library handles phonemization and inference in one call
        const audio = await this.tts.generate(text, {
            voice: config.voice,
            speed: config.speed
        });

        return {
            audio: audio.data, // Float32Array
            sampleRate: 24000
        };
    }

    getVoices() {
        // Kokoro-js comes with standard voices
        return [
            { id: 'af_heart', name: 'HEART (US)' },
            { id: 'af_bella', name: 'BELLA (US)' },
            { id: 'af_sarah', name: 'SARAH (US)' },
            { id: 'am_adam', name: 'ADAM (US)' },
            { id: 'bf_emma', name: 'EMMA (UK)' }
        ];
    }
}