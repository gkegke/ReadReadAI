import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { db } from '../db';
import { storage } from '../services/storage';
import { AudioScheduler } from '../lib/audio-scheduler';
import { ProjectActions } from '../services/ProjectActions';

/**
 * usePlaybackEngine
 * 
 * Now self-sufficient. It monitors the activeChunkId from Zustand 
 * and fetches the necessary metadata directly from Dexie.
 */
export const usePlaybackEngine = () => {
  const { 
    activeChunkId, isPlaying, playbackSpeed, queue,
    setIsPlaying, playNext, setTime 
  } = useAudioStore();
  
  const schedulerRef = useRef<AudioScheduler | null>(null);
  
  useEffect(() => {
    const scheduler = new AudioScheduler();
    schedulerRef.current = scheduler;
    
    scheduler.setHandlers(
        () => playNext(), 
        (t) => setTime(t, 0)
    );
    
    return () => scheduler.destroy();
  }, [playNext, setTime]); 

  useEffect(() => {
      const s = schedulerRef.current;
      if (!s) return;
      if (!isPlaying) s.stop();
      s.setSpeed(playbackSpeed);
  }, [isPlaying, playbackSpeed]);

  useEffect(() => {
      const s = schedulerRef.current;
      if (!s || !activeChunkId || !isPlaying) return;

      const loadAndPlay = async () => {
          // Fetch chunk data directly
          const currentChunk = await db.chunks.get(activeChunkId);
          if (!currentChunk) return;

          const cachedMeta = await db.audioCache.get(currentChunk.cleanTextHash);
          
          if (cachedMeta) {
              try {
                const blob = await storage.readFile(cachedMeta.path);
                await s.playImmediate(blob, playbackSpeed);
              } catch (e) {
                  ProjectActions.generateChunkAudio(activeChunkId);
                  setIsPlaying(false);
              }
          } else {
              // If not generated, trigger it (Manager will handle priority)
              if(currentChunk.status === 'pending' || currentChunk.status === 'failed_tts') {
                   ProjectActions.generateChunkAudio(activeChunkId);
              }
          }
      };

      loadAndPlay();
      
      // OPTIONAL: Preload Logic
      const preloadNext = async () => {
          const idx = queue.indexOf(activeChunkId);
          if (idx !== -1 && idx < queue.length - 1) {
              const nextId = queue[idx + 1];
              const nextChunk = await db.chunks.get(nextId);
              if (nextChunk) {
                  const cached = await db.audioCache.get(nextChunk.cleanTextHash);
                  if (cached) {
                      // Triggering a read-to-memory cache could be done here
                      // For now, AudioContext decoding is fast enough on-demand
                  }
              }
          }
      };
      preloadNext();

  }, [activeChunkId, isPlaying, playbackSpeed, queue, setIsPlaying]); 
};