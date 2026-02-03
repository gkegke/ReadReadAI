import { create } from 'zustand';

interface AudioState {
  isPlaying: boolean;
  activeChunkId: number | null;
  playbackSpeed: number;
  
  // Epic 5: Play Queue
  // We explicitly track the sequence of playback. 
  // This allows for future features like Shuffle, filtering, or "Play from here".
  queue: number[]; 

  // Time Tracking
  currentTime: number;
  duration: number;
  
  setIsPlaying: (isPlaying: boolean) => void;
  setActiveChunkId: (id: number | null) => void;
  setQueue: (chunkIds: number[]) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlay: () => void;
  
  // Navigation
  playNext: () => void;
  playPrev: () => void;
  
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
  
  setActiveChunkId: (id) => set({ activeChunkId: id, currentTime: 0, duration: 0 }),
  
  setQueue: (queue) => set({ queue }),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  togglePlay: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },

  playNext: () => {
    const { queue, activeChunkId } = get();
    if (activeChunkId === null) return;
    
    const idx = queue.indexOf(activeChunkId);
    if (idx !== -1 && idx < queue.length - 1) {
      set({ activeChunkId: queue[idx + 1], currentTime: 0, duration: 0 });
    } else {
      set({ isPlaying: false });
    }
  },

  playPrev: () => {
    const { queue, activeChunkId } = get();
    if (activeChunkId === null) return;
    
    const idx = queue.indexOf(activeChunkId);
    if (idx > 0) {
      set({ activeChunkId: queue[idx - 1], currentTime: 0, duration: 0 });
    }
  },

  setTime: (currentTime, duration) => set({ currentTime, duration })
}));