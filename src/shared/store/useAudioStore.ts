import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; 
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';
import { logger } from '../services/Logger';

interface AudioState {
  playbackState: PlaybackState;
  isPlaying: boolean; // [ISSUE 1 FIX]
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  setActiveChunkId: (id: number | null) => void;
  togglePlay: () => void;
  playNext: () => Promise<void>;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  audioPlaybackService.actor.subscribe((snapshot) => {
      set({ 
          playbackState: snapshot.value as PlaybackState,
          // [ISSUE 1 FIX] Centralized logic for "Is Audio Actually Playing"
          isPlaying: snapshot.value === PlaybackState.PLAYING,
          activeChunkId: snapshot.context.activeChunkId 
      });
  });

  audioPlaybackService.bind(
    (currentTime: number, duration: number) => set({ currentTime, duration }),
    () => get().playNext()
  );

  return {
    playbackState: PlaybackState.IDLE,
    isPlaying: false,
    activeChunkId: null,
    playbackSpeed: 1.0,
    currentTime: 0,
    duration: 0,

    setActiveChunkId: (id) => set({ activeChunkId: id, currentTime: 0, duration: 0 }),
    togglePlay: () => audioPlaybackService.toggle(),
    
    playNext: async () => {
      const { activeChunkId } = get();
      if (!activeChunkId) return;

      const nextChunk = await ChunkRepository.getNext(activeChunkId);
      if (nextChunk) {
          set({ activeChunkId: nextChunk.id, currentTime: 0, duration: 0 });
          
          try {
              await ProjectRepository.ensureChunkAudio(nextChunk.id!);
              const fresh = await ChunkRepository.get(nextChunk.id!);
              if (fresh?.generatedFilePath) {
                  const blob = await storage.readFile(fresh.generatedFilePath);
                  audioPlaybackService.playChunk(nextChunk.id!, blob);
                  return;
              }
          } catch (e) {
              logger.warn('AudioStore', 'Autoplay skipped due to generation failure.');
              get().playNext();
              return;
          }
      }
      
      audioPlaybackService.stop();
    }
  };
});