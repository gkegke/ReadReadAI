/**
 * Types definition for the Text-to-Speech Engine
 * and Web Worker communication.
 */

export type TTSProvider = 'kokoro' | 'kitten' | 'dummy';

export interface TTSModelDef {
  id: string;
  name: string;
  provider: TTSProvider;
  description: string;
  config?: {
    dtype?: string; // For ONNX models (q4, q8, fp16)
  };
}

export const AVAILABLE_MODELS: TTSModelDef[] = [
  { 
    id: 'kokoro-v1-q8', 
    name: 'Kokoro (Balanced)', 
    provider: 'kokoro', 
    description: 'Standard quality (q8). Good balance of speed and fidelity.',
    config: { dtype: 'q8' }
  },
  { 
    id: 'kokoro-v1-fp16', 
    name: 'Kokoro (High Res)', 
    provider: 'kokoro', 
    description: 'High precision (fp16). Very slow, best quality.',
    config: { dtype: 'fp16' }
  },
  {
    id: 'kitten-v0-q8',
    name: 'Kitten TTS Nano',
    provider: 'kitten',
    description: 'Extremely lightweight (~24MB). Best for older devices.',
    config: { dtype: 'q8' }
  },
  { 
    id: 'debug-sine', 
    name: 'Debug (Instant)', 
    provider: 'dummy', 
    description: 'Generates a beep instantly. Use to test app features.',
    config: {} 
  }
];

export interface ModelConfig {
  voice: string;
  speed: number;
  lang: string;
}

// --- Worker Messages ---

export type TTSWorkerRequest =
  // Added rootHandle for OPFS handoff
  | { type: 'INIT_MODEL'; payload: { modelId: string; rootHandle?: FileSystemDirectoryHandle } }
  | { 
      type: 'GENERATE', 
      payload: { 
        text: string; 
        config: ModelConfig; 
        id: string;
        filepath: string; 
      } 
    };

export type TTSWorkerResponse =
  | { type: 'INIT_SUCCESS'; payload: { modelId: string; voices?: {id: string, name: string}[] } }
  | { type: 'INIT_ERROR'; error: string }
  | { 
      type: 'GENERATION_COMPLETE'; 
      payload: { 
        id: string; 
        byteSize: number; 
        blob?: Blob; 
      } 
    }
  | { type: 'GENERATION_ERROR'; payload: { id: string; error: string } }
  | { type: 'PROGRESS'; payload: { phase: string; percent: number } };

export enum ModelStatus {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR',
}