import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';

interface AudioState {
  playbackState: PlaybackState;
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  
  setPlaybackState: (state: PlaybackState) => void;
  setActiveChunkId: (id: number | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlay: () => Promise<void>;
  playNext: () => void;
  setTime: (current: number, duration: number) => void;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  // CRITICAL: Bind the service events to the store actions to close the loop
  // without importing the store in the service.
  audioPlaybackService.bind(
    (currentTime, duration) => set({ currentTime, duration }),
    () => get().playNext()
  );

  return {
    playbackState: PlaybackState.IDLE,
    activeChunkId: null,
    playbackSpeed: 1.0,
    currentTime: 0,
    duration: 0,

    setPlaybackState: (playbackState) => set({ playbackState }),
    
    setActiveChunkId: (id) => set({ activeChunkId: id, currentTime: 0, duration: 0 }),
    
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    
    togglePlay: async () => {
      const newState = await audioPlaybackService.toggle();
      set({ playbackState: newState });
    },
    
    playNext: () => {
      // Logic handled by components listening to activeChunkId change
      // or explicit next logic here if we want to bypass the component layer.
      // For now, we will rely on usePlaybackEngine hook to pick up the change.
      const current = get().activeChunkId;
      // We set it to null or signal completion, actual next-chunk logic is in the engine hook
      // But we can trigger a "seek next" via a computed derived state if needed.
      console.log("[AudioStore] Worklet finished chunk", current);
    },

    setTime: (currentTime, duration) => set({ currentTime, duration })
  };
});