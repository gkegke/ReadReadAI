import { WavEncoder } from '../lib/wav-encoder';
import { AVAILABLE_MODELS, type ModelConfig } from '../types/tts';
import { writeToHandle } from '../lib/storage-shared';

console.log("[Worker] Script evaluation started...");

let currentEngine: any = null;
let currentModelId: string | null = null;
let isInitializing = false;
let opfsRoot: FileSystemDirectoryHandle | null = null;

let taskQueue: Promise<void> = Promise.resolve();

function reply(message: any) {
  self.postMessage(message);
}

async function initModel(modelId: string, rootHandle?: FileSystemDirectoryHandle) {
    if (currentModelId === modelId || isInitializing) return;
    isInitializing = true;
    
    if (rootHandle) {
        opfsRoot = rootHandle;
        console.log("[Worker] OPFS Handle received.");
    }

    try {
        const modelDef = AVAILABLE_MODELS.find(m => m.id === modelId);
        if (!modelDef) throw new Error(`Model ${modelId} not found`);

        reply({ type: 'PROGRESS', payload: { phase: `Loading ${modelDef.name}...`, percent: 10 } });

        let EngineClass;
        switch (modelDef.provider) {
            case 'kokoro':
                const { KokoroEngine } = await import('../lib/tts/KokoroEngine');
                EngineClass = KokoroEngine;
                break;
            case 'kitten':
                const { KittenEngine } = await import('../lib/tts/KittenEngine');
                EngineClass = KittenEngine;
                break;
            case 'dummy':
                EngineClass = null;
                break;
            default:
                throw new Error(`Unsupported provider: ${modelDef.provider}`);
        }

        if (EngineClass) {
            currentEngine = new EngineClass();
            await currentEngine.init(modelDef.config);
        } else {
            currentEngine = null;
        }

        currentModelId = modelId;
        const voices = currentEngine ? currentEngine.getVoices() : [];
        reply({ type: 'INIT_SUCCESS', payload: { modelId, voices } });

    } catch (e: any) {
        console.error("[Worker] Initialization failed:", e);
        reply({ type: 'INIT_ERROR', error: e.message || String(e) });
    } finally {
        isInitializing = false;
    }
}

async function generate(id: string, text: string, config: ModelConfig, filepath: string) {
    try {
        let wavBlob: Blob;
        if (!currentEngine) {
            const sampleRate = 24000;
            const samples = new Float32Array(sampleRate * 0.5);
            for(let i=0; i<samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * (i/sampleRate)) * 0.3;
            wavBlob = WavEncoder.encode(samples, sampleRate);
        } else {
            const result = await currentEngine.generate(text, config);
            wavBlob = WavEncoder.encode(result.audio, result.sampleRate);
        }

        try {
            if (opfsRoot) {
                // Use the centralized shared storage logic
                await writeToHandle(opfsRoot, filepath, wavBlob);
                reply({ type: 'GENERATION_COMPLETE', payload: { id, byteSize: wavBlob.size } });
            } else {
                reply({ type: 'GENERATION_COMPLETE', payload: { id, byteSize: wavBlob.size, blob: wavBlob } });
            }
        } catch (storageErr) {
            console.warn("[Worker] OPFS write failed, sending blob fallback", storageErr);
            reply({ type: 'GENERATION_COMPLETE', payload: { id, byteSize: wavBlob.size, blob: wavBlob } });
        }
    } catch (e: any) {
        reply({ type: 'GENERATION_ERROR', payload: { id, error: e.message || String(e) } });
    }
}

self.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'INIT_MODEL') {
        taskQueue = taskQueue.then(() => initModel(payload.modelId, payload.rootHandle));
    }
    if (type === 'GENERATE') {
        taskQueue = taskQueue.then(() => generate(payload.id, payload.text, payload.config, payload.filepath));
    }
};

reply({ type: 'WORKER_BOOTED' });