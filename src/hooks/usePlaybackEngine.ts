import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore } from '../store/useProjectStore';
import { db } from '../db';
import { storage } from '../services/storage';
import type { Chunk } from '../types/schema';
import { AudioScheduler } from '../lib/audio-scheduler';

/**
 * usePlaybackEngine
 * 
 * Manages the AudioScheduler and syncs it with the Zustand Audio Store.
 */
export const usePlaybackEngine = (chunks: Chunk[] | undefined) => {
  const { 
    activeChunkId, isPlaying, playbackSpeed, queue,
    setIsPlaying, playNext, setTime 
  } = useAudioStore();
  
  const { generateChunkAudio } = useProjectStore();
  const schedulerRef = useRef<AudioScheduler | null>(null);
  
  useEffect(() => {
    const scheduler = new AudioScheduler();
    schedulerRef.current = scheduler;

    scheduler.setHandlers(
        () => playNext(),
        (t, d) => setTime(t, d)
    );

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
          // Use public API to avoid redundant playback commands on gapless swaps
          if (s.activeHash === currentChunk.cleanTextHash) {
              return; 
          }

          const cachedMeta = await db.audioCache.get(currentChunk.cleanTextHash);
          if (cachedMeta) {
              const blob = await storage.readFile(cachedMeta.path);
              await s.playImmediate(blob, currentChunk.cleanTextHash, playbackSpeed);
              if (!isPlaying) setIsPlaying(true);
          } else {
              if (currentChunk.status !== 'generated' && currentChunk.status !== 'processing') {
                  generateChunkAudio(currentChunk.id!);
              }
          }
      };

      const preload = async () => {
          const idx = queue.indexOf(activeChunkId);
          if (idx === -1 || idx >= queue.length - 1) return;
          
          const nextId = queue[idx + 1];
          const nextChunk = chunks.find(c => c.id === nextId);
          
          if (!nextChunk) return;

          if (nextChunk.status === 'pending') {
              generateChunkAudio(nextChunk.id!);
          } else if (nextChunk.status === 'generated') {
               const cachedMeta = await db.audioCache.get(nextChunk.cleanTextHash);
               if (cachedMeta) {
                   const blob = await storage.readFile(cachedMeta.path);
                   s.preloadNext(blob, nextChunk.cleanTextHash);
               }
          }
      };

      loadCurrent();
      preload();

  }, [activeChunkId, chunks, queue, playbackSpeed, generateChunkAudio, isPlaying, setIsPlaying]); 
};