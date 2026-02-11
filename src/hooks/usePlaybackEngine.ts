import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { audioPlaybackService } from '../services/AudioPlaybackService';
import { db } from '../db';
import { storage } from '../services/storage';

export const usePlaybackEngine = () => {
  const { activeChunkId, isPlaying } = useAudioStore();
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
                       await audioPlaybackService.queueNextChunk(nextChunk.id!, blob);
                   }
               }
          }
      };

      lookahead();
  }, [activeChunkId, isPlaying]); 
};