import { create } from 'zustand';
// CRITICAL: Point to Feature Layer service
import { audioPlaybackService } from '../../features/studio/services/AudioPlaybackService';

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
  },
  
  togglePlay: () => {
    audioPlaybackService.toggle();
    set(state => ({ isPlaying: !state.isPlaying }));
  },
  
  seek: (time) => {
      // Logic for seeking would go here, calling audioPlaybackService
  },
  
  playNext: () => {},

  setTime: (currentTime, duration) => set({ currentTime, duration })
}));