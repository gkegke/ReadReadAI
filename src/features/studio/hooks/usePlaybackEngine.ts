import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { ChunkRepository } from '../api/ChunkRepository';
import { storage } from '../../../shared/services/storage';
import { audioPlaybackService } from '../services/AudioPlaybackService';
import { logger } from '../../../shared/services/Logger';

export const usePlaybackEngine = () => {
  const { activeChunkId, isPlaying } = useAudioStore();
  const lastQueuedId = useRef<number | null>(null);

  useEffect(() => {
      if (!activeChunkId || !isPlaying) return;

      const lookahead = async () => {
          // Find the next sequential chunk to predict playback
          const nextChunk = await ProjectRepository.getNextChunk(activeChunkId);

          if (nextChunk && nextChunk.id !== lastQueuedId.current) {
               lastQueuedId.current = nextChunk.id!;

               // 1. Ask the background worker to start generating the .wav if missing
               await ProjectRepository.ensureChunkAudio(nextChunk.id!);

               // 2. [Gapless Optimization] If the file is ready, bypass the OPFS reading gap
               // by passing the binary directly to the inactive audio channel.
               const updatedChunk = await ChunkRepository.get(nextChunk.id!);

               if (updatedChunk && updatedChunk.generatedFilePath) {
                   try {
                       const blob = await storage.readFile(updatedChunk.generatedFilePath);
                       audioPlaybackService.preloadChunk(updatedChunk.cleanTextHash, blob);
                   } catch (e) {
                       logger.warn("PlaybackEngine", "Lookahead preload failed", e);
                   }
               }
          }
      };

      lookahead();
  }, [activeChunkId, isPlaying]);
};
