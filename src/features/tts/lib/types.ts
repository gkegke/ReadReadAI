import type { ModelConfig } from "../../../shared/types/tts";

export interface AudioResult {
    audio: Float32Array;
    sampleRate: number;
}

export abstract class TTSEngine {
    abstract init(config?: any): Promise<void>;
    abstract generate(text: string, config: ModelConfig): Promise<AudioResult>;
    abstract getVoices(): { id: string; name: string }[];
}
