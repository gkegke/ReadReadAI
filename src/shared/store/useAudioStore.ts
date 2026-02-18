import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; // Import Repo

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
    
    /**
     * [CRITICAL] Auto-Advance Logic
     * Queries the next sequential chunk. If found, plays it. 
     * If not, the queue ends.
     */
    playNext: async () => {
      const { activeChunkId } = get();
      if (activeChunkId) {
          const nextChunk = await ChunkRepository.getNext(activeChunkId);
          if (nextChunk) {
              // We set the active ID, which triggers the useEffect in usePlaybackEngine
              // to load the audio blob and send it to the service.
              set({ activeChunkId: nextChunk.id, currentTime: 0, duration: 0 });
          } else {
              set({ playbackState: PlaybackState.IDLE });
          }
      }
    },

    setTime: (currentTime, duration) => set({ currentTime, duration })
  };
});