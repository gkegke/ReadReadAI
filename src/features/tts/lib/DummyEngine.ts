import { TTSEngine, type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';

/**
 * DummyEngine (Epic 6: E2E Playwright Mock Harness)
 * Provides instant fake audio output to allow full integration testing
 * of IndexedDB, OPFS, and the UI state machines without loading 100MB+ models.
 */
export class DummyEngine extends TTSEngine {
    async init(): Promise<void> {
        // Instant simulated initialization
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        // Instantly generate a short 100ms sine wave beep
        const sampleRate = 24000;
        const duration = 0.1;
        const length = sampleRate * duration;
        const audio = new Float32Array(length);
        
        // Populate standard 440hz Tone
        for (let i = 0; i < length; i++) {
            audio[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate));
        }
        
        return {
            audio, 
            sampleRate 
        };
    }

    getVoices() {
        return [{ id: 'dummy_voice', name: 'Mock CI Runner Voice' }];
    }
}