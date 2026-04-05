export type TTSProvider = 'kokoro' | 'dummy';

export interface TTSModelDef {
  id: string;
  name: string;
  provider: TTSProvider;
  description: string;
  config: {
    dtype: 'q8' | 'fp16' | 'fp32' | 'base'; // base maps to standard
  };
}

export interface TTSWorkerApi {
    initModel(modelId: string, unused: any, onProgress: (phase: string, percent: number) => void): Promise<{ modelId: string, voices: {id: string, name: string}[] }>;
    generate(text: string, config: ModelConfig, filepath: string): Promise<{ byteSize: number, peaks: number[], blob?: Blob }>;
}

export const AVAILABLE_MODELS: TTSModelDef[] = [
  {
    id: 'kokoro-perf',
    name: 'Kokoro Performance',
    provider: 'kokoro',
    description: '8-bit Quantized. Very fast, lower RAM usage.',
    config: { dtype: 'q8' }
  },
  {
    id: 'kokoro-balanced',
    name: 'Kokoro Balanced',
    provider: 'kokoro',
    description: 'Standard precision. Good for most modern laptops.',
    config: { dtype: 'base' }
  },
  {
    id: 'kokoro-high',
    name: 'Kokoro High Quality',
    provider: 'kokoro',
    description: 'FP16 Precision. Best audio quality, requires more GPU/CPU.',
    config: { dtype: 'fp16' }
  },
  {
    id: 'debug-sine',
    name: 'Debug (Instant)',
    provider: 'dummy',
    description: 'Generates a beep instantly. Use to test app features.',
    config: { dtype: 'base' }
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
