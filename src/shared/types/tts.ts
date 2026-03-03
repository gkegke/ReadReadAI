export type TTSProvider = 'kokoro' | 'kitten' | 'dummy';

export interface TTSModelDef {
  id: string;
  name: string;
  provider: TTSProvider;
  description: string;
  config?: {
    dtype?: string;
  };
}

// Added the missing interface for the Worker Proxy
export interface TTSWorkerApi {
    initModel(modelId: string, unused: any, onProgress: (phase: string, percent: number) => void): Promise<{ modelId: string, voices: {id: string, name: string}[] }>;
    generate(text: string, config: ModelConfig, filepath: string): Promise<{ byteSize: number, peaks: number[], blob?: Blob }>;
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

export enum ModelStatus {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR',
}