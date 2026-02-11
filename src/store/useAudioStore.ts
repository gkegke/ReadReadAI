import { create } from 'zustand';
import { audioPlaybackService } from '../services/AudioPlaybackService';

interface AudioState {
  isPlaying: boolean;
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  
  setIsPlaying: (isPlaying: boolean) => void;
  setActiveChunkId: (id: number | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  seek: (time: number) => void;
  setTime: (current: number, duration: number) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isPlaying: false,
  activeChunkId: null,
  playbackSpeed: 1.0,
  currentTime: 0,
  duration: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setActiveChunkId: (id) => set({ activeChunkId: id }),
  
  setPlaybackSpeed: (speed) => {
      set({ playbackSpeed: speed });
      // Web Audio context speed adjustment would happen here in Phase 3
  },
  
  togglePlay: () => {
    audioPlaybackService.toggle();
    set(state => ({ isPlaying: !state.isPlaying }));
  },
  
  seek: (time) => audioPlaybackService.seek(time),
  
  playNext: () => {
    // With WebAudio scheduling, "playNext" is often handled by the scheduler proactively.
    // This hook remains for manual skip buttons.
  },

  setTime: (currentTime, duration) => set({ currentTime, duration })
}));