import { BaseOnnxEngine } from './BaseOnnxEngine';
import { type AudioResult } from './types';
import type { ModelConfig } from '../../../shared/types/tts';
import { assetClient } from './utils';
import { logger } from '../../../shared/services/Logger';
import * as ort from 'onnxruntime-web';

/**
 * KittenEngine (V1.3 - Robust Tensor Orchestration)
 * [FIX: EPIC 1] Dynamic tensor matching explicitly handles ONNX version
 * differences without throwing "invalid input 'tokens'".
 */
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
        
        // [CRITICAL: ROBUSTNESS] Prevent BERT max sequence length crash
        // The Kitten (VITS/BERT) ONNX models typically have a hard-coded 512 token limit.
        if (inputIds.length > 510) {
            logger.warn('KittenEngine', `Sequence too long (${inputIds.length}), truncating to 510 to prevent OOM/Shape errors.`);
            inputIds = inputIds.slice(0, 510);
            inputIds[inputIds.length - 1] = this.vocab['$'] ?? 0;
        }

        while (inputIds.length < 5) {
            inputIds.push(this.vocab[' '] ?? 0);
        }

        const sequenceLength = inputIds.length;
        
        const tensorIds = this.createInt64Tensor(inputIds, [1, sequenceLength]);
        const tensorLengths = this.createInt64Tensor([sequenceLength], [1]);
        
        const maskData = new Array(sequenceLength).fill(1);
        const tensorMask = this.createInt64Tensor(maskData, [1, sequenceLength]);
        
        const voiceId = config.voice in this.voices ? config.voice : Object.keys(this.voices)[0];
        const speakerEmbedding = new Float32Array(this.voices[voiceId][0]);
        const tensorStyle = this.createFloat32Tensor(speakerEmbedding, [1, speakerEmbedding.length]);
        
        const tensorSpeed = this.createFloat32Tensor([config.speed || 1.0], [1]);

        logger.debug('KittenEngine', 'Executing Inference Session', { 
            seqLen: sequenceLength, 
            voiceId 
        });

        // [EPIC 1] Guard against 'invalid input tokens' by only injecting recognized parameters
        const feed: Record<string, ort.Tensor> = {};
        const expectedInputs = this.session!.inputNames;

        if (expectedInputs.includes('input_ids')) feed['input_ids'] = tensorIds;
        else if (expectedInputs.includes('tokens')) feed['tokens'] = tensorIds;
        else if (expectedInputs.includes('input')) feed['input'] = tensorIds;

        if (expectedInputs.includes('input_lengths')) feed['input_lengths'] = tensorLengths;
        if (expectedInputs.includes('attention_mask')) feed['attention_mask'] = tensorMask;
        if (expectedInputs.includes('style')) feed['style'] = tensorStyle;
        if (expectedInputs.includes('speed')) feed['speed'] = tensorSpeed;
        if (expectedInputs.includes('scales')) feed['scales'] = this.createFloat32Tensor([0.667, config.speed || 1.0, 0.8], [3]);

        try {
            const results = await this.session!.run(feed);

            return {
                audio: results.waveform.data as Float32Array,
                sampleRate: 24000
            };
        } catch (err: any) {
            logger.error('KittenEngine', 'ORT Run Failed', { 
                error: err.message,
                inputIds,
                vocabSize: Object.keys(this.vocab).length
            });
            throw err;
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