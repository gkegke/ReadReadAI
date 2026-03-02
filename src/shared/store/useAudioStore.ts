// [FILE: /web/src/shared/store/useAudioStore.ts]
import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; 
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';
import { logger } from '../services/Logger';
import { useProjectStore } from './useProjectStore';

interface AudioState {
  playbackState: PlaybackState;
  isPlaying: boolean; 
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  setActiveChunkId: (id: number | null) => void;
  togglePlay: () => void;
  playNext: () => Promise<void>;
  skipToChunk: (id: number) => Promise<void>;
  stopAll: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  audioPlaybackService.actor.subscribe((snapshot) => {
      set({ 
          playbackState: snapshot.value as PlaybackState,
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
    
    /**
     * [FIX: ISSUE 1] stopAll
     * Explicitly terminates the service and clears local store state.
     */
    stopAll: () => {
        audioPlaybackService.stop();
        set({ activeChunkId: null, isPlaying: false, currentTime: 0, duration: 0 });
    },

    skipToChunk: async (id: number) => {
        const wasPlaying = get().isPlaying;
        set({ activeChunkId: id, currentTime: 0, duration: 0 });

        if (wasPlaying) {
            try {
                await ProjectRepository.ensureChunkAudio(id);
                const fresh = await ChunkRepository.get(id);
                if (fresh?.generatedFilePath) {
                    const blob = await storage.readFile(fresh.generatedFilePath);
                    audioPlaybackService.playChunk(id, blob);
                }
            } catch (e) {
                logger.error('AudioStore', 'Manual skip failed to play', e);
            }
        }
    },

    playNext: async () => {
      // [FIX: ISSUE 1] Guard: If we are no longer in a project, abort the sequence.
      const activeProject = useProjectStore.getState().activeProjectId;
      if (!activeProject) {
          logger.info('AudioStore', 'Autoplay aborted: No active project.');
          get().stopAll();
          return;
      }

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
      
      get().stopAll();
    }
  };
});