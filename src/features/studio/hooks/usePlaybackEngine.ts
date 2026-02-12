import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { useServices } from '../../../shared/context/ServiceContext'; // UPDATED: Use Context
import { db } from '../../../shared/db';

export const usePlaybackEngine = () => {
  const { activeChunkId, isPlaying } = useAudioStore();
  const { playback, storage } = useServices(); // UPDATED: Consumed via DI
  const lastQueuedId = useRef<number | null>(null);

  useEffect(() => {
      if (!activeChunkId || !isPlaying) return;

      const lookahead = async () => {
          // Find the next chunk to pre-buffer
          const nextChunk = await ProjectRepository.getNextChunk(activeChunkId);
          
          if (nextChunk && nextChunk.id !== lastQueuedId.current) {
               // Ensure audio exists
               await ProjectRepository.ensureChunkAudio(nextChunk.id!);

               if (nextChunk.status === 'generated' && nextChunk.cleanTextHash) {
                   const meta = await db.audioCache.get(nextChunk.cleanTextHash);
                   if (meta) {
                       const blob = await storage.readFile(meta.path);
                       
                       // Feed the gapless scheduler
                       lastQueuedId.current = nextChunk.id!;
                       await playback.queueNextChunk(nextChunk.id!, blob);
                   }
               }
          }
      };

      lookahead();
  }, [activeChunkId, isPlaying, playback, storage]); 
};