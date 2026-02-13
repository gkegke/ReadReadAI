import React, { useState, useEffect, memo } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { PlayCircle, PauseCircle, Loader2 } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useServices } from '../../../shared/context/ServiceContext';
import { WaveformPlayer } from './WaveformPlayer';
import { WaveformCanvas } from './WaveformCanvas';
import { PlaybackState } from '../services/AudioPlaybackService';
import { cva } from 'class-variance-authority';
import type { Chunk } from '../../../shared/types/schema';

/**
 * [MAINTAINABILITY] Chunk UI Variants
 */
const chunkVariants = {
    container: cva(
        "group relative pl-6 border-l-2 py-4 transition-all",
        {
            variants: {
                active: {
                    true: "border-primary",
                    false: "border-transparent hover:border-border"
                }
            },
            defaultVariants: { active: false }
        }
    ),
    card: cva(
        "rounded-xl p-5 border transition-all",
        {
            variants: {
                active: {
                    true: "bg-secondary/30 border-border shadow-sm",
                    false: "border-transparent hover:bg-secondary/10"
                }
            },
            defaultVariants: { active: false }
        }
    )
};

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
}

export const ChunkItem = memo(({ chunk, isActive }: ChunkItemProps) => {
  const { playbackState } = useAudioStore();
  const { playback, storage } = useServices();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const isPlaying = isActive && playbackState === PlaybackState.PLAYING;

  useEffect(() => {
      let isMounted = true;
      if (isActive && chunk.status === 'generated' && chunk.generatedFilePath) {
          storage.readFile(chunk.generatedFilePath).then(blob => {
              if (isMounted) setAudioBlob(blob);
          });
      }
      return () => { isMounted = false; };
  }, [isActive, chunk.generatedFilePath, chunk.status, storage]);

  const handlePlay = async () => {
      if (isActive) {
          playback.toggle();
      } else {
          const blob = audioBlob || await storage.readFile(chunk.generatedFilePath!);
          playback.playChunk(chunk.id!, blob);
      }
  };

  return (
    <div className={chunkVariants.container({ active: isActive })}>
      <div className={chunkVariants.card({ active: isActive })}>
        <p className="text-lg font-serif leading-relaxed mb-4">{chunk.textContent}</p>
        
        <div className="h-12 flex items-center">
            {chunk.status === 'processing' ? (
                <div className="w-full flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Synthesizing...</span>
                </div>
            ) : isActive && audioBlob ? (
                <WaveformPlayer blob={audioBlob} isActive={isActive} chunkId={chunk.id!} />
            ) : chunk.waveformPeaks ? (
                <WaveformCanvas peaks={chunk.waveformPeaks} />
            ) : (
                <div className="w-full h-[2px] bg-border/30 rounded-full" />
            )}
        </div>

        <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                {chunk.status}
            </span>
            <button 
                onClick={handlePlay} 
                disabled={chunk.status !== 'generated'}
                className="text-primary hover:scale-110 transition-transform disabled:opacity-20"
            >
                {isPlaying ? <PauseCircle /> : <PlayCircle />}
            </button>
        </div>
      </div>
    </div>
  );
});