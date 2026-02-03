import * as ort from 'onnxruntime-web';
import { TTSEngine } from './types';
import { cachedFetch, cleanTextForTTS } from './utils';

// Configure ONNX Runtime Web WASM paths globally once.
// This ensures that all inheriting engines use the correct local assets.
ort.env.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm': '/onnx-runtime/ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd.wasm': '/onnx-runtime/ort-wasm-simd.wasm',
    'ort-wasm.wasm': '/onnx-runtime/ort-wasm.wasm',
    'ort-wasm-simd-threaded.jsep.wasm': '/onnx-runtime/ort-wasm-simd-threaded.jsep.wasm',
};

/**
 * Abstract Base Class for ONNX-based TTS Engines.
 * Encapsulates common logic for:
 * 1. Session Initialization
 * 2. Text Cleaning & Phonemization
 * 3. Tensor Creation helpers
 */
export abstract class BaseOnnxEngine extends TTSEngine {
    protected session: ort.InferenceSession | null = null;

    /**
     * Loads the ONNX model from the given path into a generic InferenceSession.
     */
    protected async initSession(modelPath: string): Promise<void> {
        try {
            const modelResponse = await cachedFetch(modelPath);
            const modelBuffer = await modelResponse.arrayBuffer();
            
            this.session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['wasm'],
            });
        } catch (e) {
            console.error(`[BaseOnnxEngine] Failed to load model: ${modelPath}`, e);
            throw new Error(`Failed to load ONNX model from ${modelPath}`);
        }
    }

    /**
     * Standardizes text processing pipeline:
     * Clean -> Import Phonemizer (Lazy) -> Phonemize
     */
    protected async getPhonemes(text: string, lang: string = 'en-us'): Promise<string> {
        const cleaned = cleanTextForTTS(text);
        
        // Lazy load phonemizer to keep worker startup fast
        const { phonemize } = await import('phonemizer');
        
        // Note: 'phonemizer' package might behave differently depending on version/bundling
        // We assume the standard API here as used in previous implementations
        return await phonemize(cleaned, lang);
    }

    /**
     * Helper to create typed Tensors for ONNX Runtime.
     */
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