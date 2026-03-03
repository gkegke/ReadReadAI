import * as ort from 'onnxruntime-web';
import { TTSEngine } from './types';
import { cachedFetch, cleanTextForTTS } from './utils';
import { g2pService } from '../services/G2PService'; 
import { logger } from '../../../shared/services/Logger';

// [CRITICAL FIX] ONNX Runtime Web types expect specific property names.
// Keys must match actual filenames or the specific proxy/wasm file mappings.
ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm': '/onnx-runtime/ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd.wasm': '/onnx-runtime/ort-wasm-simd.wasm',
    'ort-wasm.wasm': '/onnx-runtime/ort-wasm.wasm',
    'ort-wasm-simd-threaded.jsep.wasm': '/onnx-runtime/ort-wasm-simd-threaded.jsep.wasm',
} as any; // Cast as any if local types haven't updated to latest JSEP support

// Suppression of CPU Vendor warning logs
// @ts-ignore
ort.env.logLevel = 'error';

export abstract class BaseOnnxEngine extends TTSEngine {
    protected session: ort.InferenceSession | null = null;

    protected async initSession(modelPath: string): Promise<void> {
        try {
            logger.debug('BaseOnnxEngine', `Fetching model: ${modelPath}`);
            const modelResponse = await cachedFetch(modelPath);
            const modelBuffer = await modelResponse.arrayBuffer();
            
            this.session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
            });
            logger.info('BaseOnnxEngine', `Session initialized for ${modelPath}`);
        } catch (e) {
            logger.error('BaseOnnxEngine', `Failed to load model: ${modelPath}`, e);
            throw new Error(`Failed to load ONNX model from ${modelPath}`);
        }
    }

    protected async getPhonemes(text: string, lang: string = 'en-us'): Promise<string> {
        const cleaned = cleanTextForTTS(text);
        return await g2pService.phonemize(cleaned, lang);
    }

    protected createInt64Tensor(data: number[], dims: number[]): ort.Tensor {
        return new ort.Tensor('int64', BigInt64Array.from(data.map(BigInt)), dims);
    }

    protected createFloat32Tensor(data: Float32Array | number[], dims: number[]): ort.Tensor {
        const typedData = data instanceof Float32Array ? data : new Float32Array(data);
        return new ort.Tensor('float32', typedData, dims);
    }

    protected checkSession() {
        if (!this.session) throw new Error(`${this.constructor.name} session not initialized`);
    }
}