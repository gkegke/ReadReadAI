import { BaseOnnxEngine } from './BaseOnnxEngine';
import { type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';
import { assetClient } from './utils';
import { logger } from '../../../shared/services/Logger';
import * as ort from 'onnxruntime-web';

export class KittenEngine extends BaseOnnxEngine {
    private vocab: Record<string, number> = {};
    private voices: any = null;

    async init(): Promise<void> {
        await this.initSession('/tts-models/kitten-tts/model_quantized.onnx');

        try {
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
        
        if (!text || text.trim().length === 0) {
            throw new Error("KittenEngine: Cannot generate audio for empty text.");
        }

        const phonemes = await this.getPhonemes(text, 'en-us');
        const tokensWithBoundaries = `$${phonemes}$`;
        let inputIds = tokensWithBoundaries.split('').map(char => this.vocab[char] ?? 0);
        
        if (inputIds.length > 510) {
            logger.warn('KittenEngine', `Sequence too long (${inputIds.length}), truncating.`);
            inputIds = inputIds.slice(0, 510);
            inputIds[inputIds.length - 1] = this.vocab['$'] ?? 0;
        }

        while (inputIds.length < 5) inputIds.push(this.vocab[' '] ?? 0);

        const seqLen = inputIds.length;
        const tIds = this.createInt64Tensor(inputIds, [1, seqLen]);
        const tLen = this.createInt64Tensor([seqLen], [1]);
        const tMask = this.createInt64Tensor(new Array(seqLen).fill(1), [1, seqLen]);
        
        const voiceId = config.voice in this.voices ? config.voice : Object.keys(this.voices)[0];
        const speakerEmbedding = new Float32Array(this.voices[voiceId][0]);
        const tStyle = this.createFloat32Tensor(speakerEmbedding, [1, speakerEmbedding.length]);
        const tSpeed = this.createFloat32Tensor([config.speed || 1.0], [1]);
        const tScales = this.createFloat32Tensor([0.667, config.speed || 1.0, 0.8], [3]);

        const feed: Record<string, ort.Tensor> = {};
        const expected = this.session!.inputNames;
        if (expected.includes('input_ids')) feed['input_ids'] = tIds;
        else if (expected.includes('tokens')) feed['tokens'] = tIds;
        if (expected.includes('input_lengths')) feed['input_lengths'] = tLen;
        if (expected.includes('attention_mask')) feed['attention_mask'] = tMask;
        if (expected.includes('style')) feed['style'] = tStyle;
        if (expected.includes('speed')) feed['speed'] = tSpeed;
        if (expected.includes('scales')) feed['scales'] = tScales;

        let results: ort.InferenceSession.ReturnType | null = null;
        try {
            results = await this.session!.run(feed);
            // [CRITICAL: EPIC 1] Deep copy immediately to allow disposal of the WASM-backed tensor
            const audioData = new Float32Array(results.waveform.data as Float32Array);
            
            return {
                audio: audioData,
                sampleRate: 24000
            };
        } finally {
            // [CRITICAL: EPIC 1] Explicit WASM Memory Release
            // JS GC cannot reach into the WASM Heap. These must be manually freed.
            tIds.dispose();
            tLen.dispose();
            tMask.dispose();
            tStyle.dispose();
            tSpeed.dispose();
            tScales.dispose();
            if (results && results.waveform) results.waveform.dispose();
        }
    }

    getVoices() {
        if (!this.voices) return [];
        return Object.keys(this.voices).map(key => ({
            id: key,
            name: key.replace('expr-', '').replace(/-/g, ' ')
        }));
    }
}