import { BaseOnnxEngine } from './BaseOnnxEngine';
import { type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';
import { cachedFetch } from './utils';

export class KittenEngine extends BaseOnnxEngine {
    private vocab: Record<string, number> = {};
    private voices: any = null;

    async init(): Promise<void> {
        await this.initSession('/tts-models/kitten-tts/model_quantized.onnx');

        try {
            const [tokenizerRes, voicesRes] = await Promise.all([
                cachedFetch('/tts-models/kitten-tts/tokenizer.json'),
                cachedFetch('/tts-models/kitten-tts/voices.json')
            ]);

            const tokenizerData = await tokenizerRes.json();
            this.voices = await voicesRes.json();
            this.vocab = tokenizerData.model.vocab;
        } catch (e) {
            console.error("[KittenEngine] Metadata Init Failed", e);
            throw e;
        }
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        this.checkSession();
        
        const phonemes = await this.getPhonemes(text, 'en-us');
        
        // Kitten Specific tokenization wrapped in boundaries
        const tokensWithBoundaries = `$${phonemes}$`;
        
        // Safety: Use character 0 (usually <unk> or <pad>) for unknown phonemes
        const inputIds = tokensWithBoundaries.split('').map(char => this.vocab[char] ?? 0);

        const tensorIds = this.createInt64Tensor(inputIds, [1, inputIds.length]);
        
        const voiceId = config.voice in this.voices ? config.voice : 'expr-voice-2-m';
        const speakerEmbedding = new Float32Array(this.voices[voiceId][0]);
        const tensorStyle = this.createFloat32Tensor(speakerEmbedding, [1, speakerEmbedding.length]);
        
        const tensorSpeed = this.createFloat32Tensor([config.speed || 1.0], [1]);

        const results = await this.session!.run({
            'input_ids': tensorIds,
            'style': tensorStyle,
            'speed': tensorSpeed
        });

        return {
            audio: results.waveform.data as Float32Array,
            sampleRate: 24000
        };
    }

    getVoices() {
        if (!this.voices) return [];
        return Object.keys(this.voices).map(key => ({
            id: key,
            name: key.replace('expr-', '').replace(/-/g, ' ')
        }));
    }
}