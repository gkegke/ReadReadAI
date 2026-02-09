import { useEffect } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { ProjectRepository } from '../repositories/ProjectRepository';

/**
 * The "DJ" Engine.
 * Responsibilities:
 * 1. Ensure current chunk audio exists (Just-in-time generation).
 * 2. Pre-fetch/Pre-generate the NEXT chunk for gapless playback.
 */
export const usePlaybackEngine = () => {
  const { activeChunkId, isPlaying } = useAudioStore();
  
  useEffect(() => {
      // If nothing is selected, we don't care.
      if (!activeChunkId) return;

      const engineCycle = async () => {
          // 1. Handle Current Chunk
          // If we hit play on a text block, generate it now.
          if (isPlaying) {
              await ProjectRepository.generateChunkAudio(activeChunkId, 100);
          }

          // 2. Proactive Lookahead (The "DJ" Pre-fetch)
          // Regardless of play state (but definitely if playing), 
          // ensure the NEXT chunk is ready to go.
          const nextChunk = await ProjectRepository.getNextChunk(activeChunkId);
          
          if (nextChunk) {
               // Trigger generation with Higher priority than random background jobs
               // but slightly lower than the currently playing one.
               await ProjectRepository.ensureChunkAudio(nextChunk.id!);
          }
      };

      engineCycle();
  }, [activeChunkId, isPlaying]); 
};