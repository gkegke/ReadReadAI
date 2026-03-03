import * as ort from 'onnxruntime-web';
import { TTSEngine } from './types';
import { cachedFetch, cleanTextForTTS } from './utils';
import { g2pService } from '../services/G2PService'; 
import { logger } from '../../../shared/services/Logger';

/**
 * [CRITICAL: WASM RESOLUTION]
 * [IMPORTANCE: 10/10] In Vite/Vercel, we must point ORT to the static directory 
 * where the .wasm binaries live. 
 */
const WASM_PATH_PREFIX = '/onnx-runtime/';

// Point ORT to the directory containing all WASM binaries. 
// Using the string path is more stable for TS types than individual filename keys.
ort.env.wasm.wasmPaths = WASM_PATH_PREFIX;

// [CRITICAL] Disable the proxy worker to avoid MJS resolution issues in certain environments
ort.env.wasm.proxy = false;

// Suppression of CPU Vendor warning logs
// @ts-ignore
ort.env.logLevel = 'error';

export abstract class BaseOnnxEngine extends TTSEngine {
    protected session: ort.InferenceSession | null = null;

    protected async initSession(modelPath: string): Promise<void> {
        try {
            logger.debug('BaseOnnxEngine', `Fetching model: ${modelPath}`);
            
            // Ensure the WASM binary is ready before creating session
            const modelResponse = await cachedFetch(modelPath);
            const modelBuffer = await modelResponse.arrayBuffer();
            
            this.session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
            });
            logger.info('BaseOnnxEngine', `Session initialized for ${modelPath}`);
        } catch (e: any) {
            logger.error('BaseOnnxEngine', `Failed to load model: ${modelPath}`, e);
            // Log the specific ORT error to help debug
            if (e.message?.includes('backend')) {
                logger.error('BaseOnnxEngine', 'WASM Backend initialization failed. Check COOP/COEP headers or file paths.');
            }
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