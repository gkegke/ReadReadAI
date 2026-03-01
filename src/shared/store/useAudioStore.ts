import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository'; 
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';
import { logger } from '../services/Logger';
import { db } from '../db';

interface AudioState {
  playbackState: PlaybackState;
  isPlaying: boolean;
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
  handlePlaybackError: (chunkId: number) => Promise<void>;
}

export const useAudioStore = create<AudioState>((set, get) => {
  
  audioPlaybackService.actor.subscribe((snapshot) => {
      const state = snapshot.value as PlaybackState;
      
      set({ 
          playbackState: state,
          isPlaying: state === PlaybackState.PLAYING,
          activeChunkId: snapshot.context.activeChunkId 
      });

      // [EPIC 5] Auto-healing Playback
      // Detects transition to ERROR state and triggers healing logic.
      if (state === PlaybackState.ERROR && snapshot.context.activeChunkId) {
          get().handlePlaybackError(snapshot.context.activeChunkId);
      }
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
    togglePlay: () => audioPlaybackService.toggle(),
    
    /**
     * [EPIC 5] Indestructible Playback Logic.
     * Deletes corrupted files and skips to next chunk seamlessly.
     */
    handlePlaybackError: async (chunkId) => {
      if (get().playbackState !== PlaybackState.ERROR) return;
      
      logger.warn('AudioStore', `Playback error on chunk ${chunkId}. Auto-healing...`);
      set({ playbackState: PlaybackState.INITIALIZING }); 
      
      try {
          const chunk = await ChunkRepository.get(chunkId);
          if (chunk) {
              if (chunk.generatedFilePath) {
                  await storage.deleteFile(chunk.generatedFilePath);
              }
              if (chunk.cleanTextHash) {
                  await db.audioCache.delete(chunk.cleanTextHash);
              }
              await db.chunks.update(chunkId, { status: 'pending', generatedFilePath: null });
          }
      } catch (e) {
          logger.error('AudioStore', 'Failed to heal chunk', e);
      }
      
      get().playNext();
    },
    
    playNext: async () => {
      const { activeChunkId } = get();
      if (!activeChunkId) return;

      const nextChunk = await ChunkRepository.getNext(activeChunkId);
      
      if (nextChunk) {
          set({ activeChunkId: nextChunk.id, currentTime: 0, duration: 0 });
          
          try {
              await ProjectRepository.ensureChunkAudio(nextChunk.id!);
              const freshChunk = await ChunkRepository.get(nextChunk.id!);
              
              if (freshChunk?.generatedFilePath) {
                  const blob = await storage.readFile(freshChunk.generatedFilePath);
                  audioPlaybackService.playChunk(nextChunk.id!, blob);
                  return;
              }
          } catch (e) {
              logger.error('AudioStore', 'Autoplay skip failure', e);
          }
      }
      
      audioPlaybackService.stop();
      set({ playbackState: PlaybackState.IDLE, isPlaying: false });
    },

    setTime: (currentTime, duration) => set({ currentTime, duration })
  };
});