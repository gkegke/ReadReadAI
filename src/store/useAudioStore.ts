import { create } from 'zustand';
import { audioPlaybackService } from '../services/AudioPlaybackService';

interface AudioState {
  isPlaying: boolean;
  activeChunkId: number | null;
  playbackSpeed: number;
  queue: number[]; 
  currentTime: number;
  duration: number;
  
  setIsPlaying: (isPlaying: boolean) => void;
  setActiveChunkId: (id: number | null) => void;
  setQueue: (chunkIds: number[]) => void;
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
  queue: [],
  currentTime: 0,
  duration: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setActiveChunkId: (id) => set({ activeChunkId: id, currentTime: 0 }),
  setQueue: (queue) => set({ queue }),
  
  setPlaybackSpeed: (speed) => {
      set({ playbackSpeed: speed });
      audioPlaybackService.setSpeed(speed);
  },
  
  togglePlay: () => audioPlaybackService.toggle(),
  seek: (time) => audioPlaybackService.seek(time),
  
  playNext: () => {
    const { queue, activeChunkId } = get();
    if (!activeChunkId) return;
    const idx = queue.indexOf(activeChunkId);
    if (idx !== -1 && idx < queue.length - 1) {
        set({ activeChunkId: queue[idx+1] });
    }
  },

  setTime: (currentTime, duration) => set({ currentTime, duration })
}));