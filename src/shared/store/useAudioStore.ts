import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; 
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';

interface AudioState {
  playbackState: PlaybackState;
  isPlaying: boolean; // [FIXED] Explicitly declared for React reactivity bounds
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  
  setPlaybackState: (state: PlaybackState) => void;
  setActiveChunkId: (id: number | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlay: () => void;
  playNext: () => Promise<void>;
  setTime: (current: number, duration: number) => void;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  // Single Source of Truth synchronization from Machine to Zustand
  audioPlaybackService.actor.subscribe((snapshot) => {
      set({ 
          playbackState: snapshot.value as PlaybackState,
          isPlaying: snapshot.value === PlaybackState.PLAYING, // Fix missing reactivity trigger
          activeChunkId: snapshot.context.activeChunkId 
      });
  });

  audioPlaybackService.bind(
    (currentTime, duration) => set({ currentTime, duration }),
    () => get().playNext()
  );

  return {
    playbackState: PlaybackState.IDLE,
    isPlaying: false,
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
     * [CRITICAL FIX] Orchestrating true automatic gapless advance
     * Retrieves the next DB record, ensures the audio exists physically, and fires the payload.
     */
    playNext: async () => {
      const { activeChunkId } = get();
      if (!activeChunkId) return;

      const nextChunk = await ChunkRepository.getNext(activeChunkId);
      
      if (nextChunk) {
          // Visually jump to next chunk immediately
          set({ activeChunkId: nextChunk.id, currentTime: 0, duration: 0 });
          
          try {
              await ProjectRepository.ensureChunkAudio(nextChunk.id!);
              const freshChunk = await ChunkRepository.get(nextChunk.id!);
              
              if (freshChunk?.generatedFilePath) {
                  const blob = await storage.readFile(freshChunk.generatedFilePath);
                  
                  // If the file was pre-decoded by `usePlaybackEngine.ts`, 
                  // this command will resolve in the machine instantly causing zero gap.
                  audioPlaybackService.playChunk(nextChunk.id!, blob);
                  return;
              }
          } catch (e) {
              console.error("[AudioStore] Failed to auto-play next chunk in sequence:", e);
          }
      }
      
      // End of sequence fallback
      set({ playbackState: PlaybackState.IDLE, isPlaying: false });
    },

    setTime: (currentTime, duration) => set({ currentTime, duration })
  };
});