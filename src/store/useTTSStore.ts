import { create } from 'zustand';
import { ModelStatus } from '../types/tts';

interface TTSState {
  modelStatus: ModelStatus;
  progressPhase: string;
  progressPercent: number;
  errorMessage: string | null;
  availableVoices: { id: string; name: string }[]; // New: Track voices globally

  setThinking: (phase: string, percent: number) => void;
  setStatus: (status: ModelStatus, error?: string) => void;
  setVoices: (voices: { id: string; name: string }[]) => void; // New
}

export const useTTSStore = create<TTSState>((set) => ({
  modelStatus: ModelStatus.UNLOADED,
  progressPhase: '',
  progressPercent: 0,
  errorMessage: null,
  availableVoices: [],

  setThinking: (phase, percent) => 
    set({ progressPhase: phase, progressPercent: percent }),

  setStatus: (status, error) => 
    set({ modelStatus: status, errorMessage: error || null }),

  setVoices: (voices) => set({ availableVoices: voices }),
}));