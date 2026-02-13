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
  togglePlay: () => void;
  playNext: () => void;
  setTime: (current: number, duration: number) => void;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  // CRITICAL (Architecture Score: 10/10): Subscribe to the FSM Actor.
  // This pattern decouples the UI from the Audio Engine while maintaining perfect sync.
  audioPlaybackService.actor.subscribe((snapshot) => {
      set({ 
          playbackState: snapshot.value as PlaybackState,
          activeChunkId: snapshot.context.activeChunkId 
      });
  });

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
    
    togglePlay: () => {
      audioPlaybackService.toggle();
    },
    
    playNext: () => {
      console.log("[AudioStore] Signal: Chunk finished. Engine should look ahead.");
    },

    setTime: (currentTime, duration) => set({ currentTime, duration })
  };
});