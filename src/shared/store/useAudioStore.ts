import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; 
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';
import { logger } from '../services/Logger';
import { useProjectStore } from './useProjectStore';
import { db } from '../db'; // [CRITICAL] Needed for first-chunk lookup

interface AudioState {
  playbackState: PlaybackState;
  isPlaying: boolean; 
  activeChunkId: number | null;
  playbackSpeed: number;
  currentTime: number;
  duration: number;
  setActiveChunkId: (id: number | null) => void;
  setPlaybackSpeed: (speed: number) => void;
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
    setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
    
    /**
     * togglePlay
     * [FIX: ISSUE 1] If no chunk is selected, find the first chunk in the project.
     */
    togglePlay: async () => {
        const { activeChunkId, isPlaying } = get();
        
        // If we have an active chunk, just toggle the transport
        if (activeChunkId) {
            audioPlaybackService.toggle();
            return;
        }

        // If no chunk is active, attempt to start from the beginning
        const activeProject = useProjectStore.getState().activeProjectId;
        if (!activeProject) return;

        try {
            const firstChunk = await db.chunks
                .where('projectId').equals(activeProject)
                .sortBy('orderInProject');

            if (firstChunk && firstChunk.length > 0) {
                const targetId = firstChunk[0].id!;
                // Setting active ID and starting playback logic
                await get().skipToChunk(targetId);
                
                // If skipToChunk didn't automatically trigger service (due to isPlaying check), force it
                if (audioPlaybackService.state !== PlaybackState.PLAYING) {
                    // Re-fetch blob and play
                    const fresh = await ChunkRepository.get(targetId);
                    if (fresh?.generatedFilePath) {
                        const blob = await storage.readFile(fresh.generatedFilePath);
                        audioPlaybackService.playChunk(targetId, blob);
                    }
                }
            }
        } catch (err) {
            logger.error('AudioStore', 'Failed to toggle play from empty selection', err);
        }
    },
    
    stopAll: () => {
        audioPlaybackService.stop();
        set({ activeChunkId: null, isPlaying: false, currentTime: 0, duration: 0 });
    },

    skipToChunk: async (id: number) => {
        // [UX] If we are skipping, we assume the user wants to hear it immediately
        set({ activeChunkId: id, currentTime: 0, duration: 0 });

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
    },

    playNext: async () => {
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