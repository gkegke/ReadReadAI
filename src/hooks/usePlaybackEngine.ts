import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { db } from '../db';
import { storage } from '../services/storage';
import type { Chunk } from '../types/schema';
import { AudioScheduler } from '../lib/audio-scheduler';
import { generationManager } from '../services/GenerationManager';

export const usePlaybackEngine = (chunks: Chunk[] | undefined) => {
  const { 
    activeChunkId, isPlaying, playbackSpeed, queue,
    setIsPlaying, playNext, setTime 
  } = useAudioStore();
  
  const schedulerRef = useRef<AudioScheduler | null>(null);
  
  useEffect(() => {
    const scheduler = new AudioScheduler();
    schedulerRef.current = scheduler;
    scheduler.setHandlers(() => playNext(), (t, d) => setTime(t, d));
    return () => scheduler.destroy();
  }, [playNext, setTime]); 

  useEffect(() => {
      const s = schedulerRef.current;
      if (!s) return;
      s.setSpeed(playbackSpeed);
      if (isPlaying) s.resume();
      else s.pause();
  }, [isPlaying, playbackSpeed]);

  useEffect(() => {
      const s = schedulerRef.current;
      if (!s || !activeChunkId || !chunks) return;

      const currentChunk = chunks.find(c => c.id === activeChunkId);
      if (!currentChunk) return;

      const loadCurrent = async () => {
          if (s.activeHash === currentChunk.cleanTextHash) return; 

          // Access table securely to avoid 'undefined property' issues on startup
          const cachedMeta = await db.table('audioCache').get(currentChunk.cleanTextHash);
          
          if (cachedMeta) {
              try {
                const blob = await storage.readFile(cachedMeta.path);
                await s.playImmediate(blob, currentChunk.cleanTextHash, playbackSpeed);
                if (!isPlaying) setIsPlaying(true);
              } catch (e) {
                  // File missing? Queue regeneration.
                  generationManager.queue(activeChunkId);
              }
          }
      };

      const preload = async () => {
          const idx = queue.indexOf(activeChunkId);
          if (idx === -1 || idx >= queue.length - 1) return;
          const nextId = queue[idx + 1];
          const nextChunk = chunks.find(c => c.id === nextId);
          
          if (nextChunk?.status === 'generated') {
               const cachedMeta = await db.table('audioCache').get(nextChunk.cleanTextHash);
               if (cachedMeta) {
                   try {
                       const blob = await storage.readFile(cachedMeta.path);
                       s.preloadNext(blob, nextChunk.cleanTextHash);
                   } catch (e) {}
               }
          }
      };

      loadCurrent();
      preload();
  }, [activeChunkId, chunks, queue, playbackSpeed, isPlaying, setIsPlaying]); 
};