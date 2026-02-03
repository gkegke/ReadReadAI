import { BaseOnnxEngine } from './BaseOnnxEngine';
import { type AudioResult } from './types';
import type { ModelConfig } from '../../types/tts';
import { cachedFetch } from './utils';

export class KokoroEngine extends BaseOnnxEngine {
    private tokenizer: any = null;
    private voiceEmbeddings: Record<string, Float32Array> = {};
    private voicesList: {id: string, name: string}[] = [];

    async init(): Promise<void> {
        // 1. Initialize Session via Base Class
        await this.initSession('/tts-models/kokoro/model_quantized.onnx');

        // 2. Load Tokenizer
        const tokenizerRes = await cachedFetch('/tts-models/kokoro/tokenizer.json');
        this.tokenizer = await tokenizerRes.json();

        // 3. Load Voices (Dynamic load from public dir)
        const voiceFiles = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'am_adam', 'am_michael'];
        
        await Promise.all(voiceFiles.map(async (v) => {
            try {
                const res = await cachedFetch(`/tts-models/kokoro/voices/${v}.bin`);
                const buffer = await res.arrayBuffer();
                this.voiceEmbeddings[v] = new Float32Array(buffer);
                this.voicesList.push({ id: v, name: v.replace('_', ' ').toUpperCase() });
            } catch (e) {
                console.warn(`[KokoroEngine] Voice fail: ${v}`);
            }
        }));
    }

    async generate(text: string, config: ModelConfig): Promise<AudioResult> {
        this.checkSession();

        // 1. Text Processing
        const lang = config.voice.startsWith('a') ? 'en-us' : 'en-gb';
        const phonemes = await this.getPhonemes(text, lang);
        
        // 2. Tokenization (Kokoro Specific: padded with 0)
        const vocab = this.tokenizer.model.vocab;
        const tokens = phonemes.split('').map(c => vocab[c] || 0);
        const inputIds = [0, ...tokens, 0];
        
        // 3. Tensor Prep
        const tensorIds = this.createInt64Tensor(inputIds, [1, inputIds.length]);

        // Style Embedding Logic
        const voiceKey = config.voice in this.voiceEmbeddings ? config.voice : 'af_heart';
        const fullEmbedding = this.voiceEmbeddings[voiceKey];
        
        // Kokoro style selection based on input length
        const numTokens = Math.min(Math.max(inputIds.length - 2, 0), 509);
        const offset = numTokens * 256;
        const style = fullEmbedding.slice(offset, offset + 256);
        
        const tensorStyle = this.createFloat32Tensor(style, [1, style.length]);
        const tensorSpeed = this.createFloat32Tensor([1.0 / (config.speed || 1.0)], [1]);

        // 4. Inference
        const results = await this.session!.run({
            'input_ids': tensorIds,
            'style': tensorStyle,
            'speed': tensorSpeed
        });

        return { audio: results.waveform.data as Float32Array, sampleRate: 24000 };
    }

    getVoices() { return this.voicesList; }
}