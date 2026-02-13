import { BaseOnnxEngine } from './BaseOnnxEngine';
import { type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';
import { assetClient } from './utils';
import { logger } from '../../../shared/services/Logger';

export class KittenEngine extends BaseOnnxEngine {
    private vocab: Record<string, number> = {};
    private voices: any = null;

    async init(): Promise<void> {
        await this.initSession('/tts-models/kitten-tts/model_quantized.onnx');

        try {
            // [OPTIMIZATION] Use Ky directly for metadata to handle retries/JSON parsing
            const [tokenizerData, voicesData] = await Promise.all([
                assetClient.get('/tts-models/kitten-tts/tokenizer.json').json<any>(),
                assetClient.get('/tts-models/kitten-tts/voices.json').json<any>()
            ]);

            this.voices = voicesData;
            this.vocab = tokenizerData.model.vocab;
            logger.info('KittenEngine', 'Metadata and Vocab loaded');
        } catch (e) {
            logger.error("KittenEngine", "Metadata Init Failed", e);
            throw e;
        }
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        this.checkSession();
        
        const phonemes = await this.getPhonemes(text, 'en-us');
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