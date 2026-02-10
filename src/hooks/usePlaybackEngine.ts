import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { audioPlaybackService } from '../services/AudioPlaybackService';
import { db } from '../db';
import { storage } from '../services/storage';

export const usePlaybackEngine = () => {
  const { activeChunkId, isPlaying } = useAudioStore();
  const nextChunkIdRef = useRef<number | null>(null);

  useEffect(() => {
      if (!activeChunkId || !isPlaying) return;

      const engineCycle = async () => {
          // 1. Gapless Pre-load
          // We identify the next chunk and try to push it to the AudioContext schedule
          // IF it is generated.
          
          const nextChunk = await ProjectRepository.getNextChunk(activeChunkId);
          
          if (nextChunk && nextChunk.id !== nextChunkIdRef.current) {
               // A new chunk is next in line.
               nextChunkIdRef.current = nextChunk.id!;

               // Prioritize generation
               await ProjectRepository.ensureChunkAudio(nextChunk.id!);

               // If it's ready, schedule it
               if (nextChunk.status === 'generated' && nextChunk.cleanTextHash) {
                   const meta = await db.audioCache.get(nextChunk.cleanTextHash);
                   if (meta) {
                       const blob = await storage.readFile(meta.path);
                       // false = do not play immediately, schedule for end
                       await audioPlaybackService.playChunk(nextChunk.id!, blob, 0, false);
                   }
               }
          }
      };

      engineCycle();
  }, [activeChunkId, isPlaying]); 
};