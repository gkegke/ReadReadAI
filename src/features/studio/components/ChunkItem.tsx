import React, { useState, useEffect, memo } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { PlayCircle, PauseCircle, Loader2 } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useServices } from '../../../shared/context/ServiceContext'; // UPDATED: Use Context
import { WaveformPlayer } from './WaveformPlayer';
import { WaveformCanvas } from './WaveformCanvas';
import type { Chunk } from '../../../shared/types/schema';

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
}

export const ChunkItem = memo(({ chunk, isActive }: ChunkItemProps) => {
  const { isPlaying } = useAudioStore();
  const { playback, storage } = useServices(); // UPDATED: Consumed via DI
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Load blob only if we are the active chunk (to save memory) 
  // or if we need it for interactive interaction.
  useEffect(() => {
      if (isActive && chunk.status === 'generated' && chunk.generatedFilePath) {
          storage.readFile(chunk.generatedFilePath).then(setAudioBlob);
      }
  }, [isActive, chunk.generatedFilePath, chunk.status, storage]);

  const handlePlay = async () => {
      if (isActive) {
          playback.toggle();
      } else {
          // If playing a non-active chunk, load it on demand
          const blob = audioBlob || await storage.readFile(chunk.generatedFilePath!);
          playback.playChunk(chunk.id!, blob);
      }
  };

  return (
    <div className={cn(
        "group relative pl-6 border-l-2 py-4 transition-all", 
        isActive ? "border-primary" : "border-transparent hover:border-border"
    )}>
      <div className={cn(
          "rounded-xl p-5 border transition-all",
          isActive ? "bg-secondary/30 border-border shadow-sm" : "border-transparent hover:bg-secondary/10"
      )}>
        <p className="text-lg font-serif leading-relaxed mb-4">{chunk.textContent}</p>
        
        <div className="h-12 flex items-center">
            {chunk.status === 'processing' ? (
                <div className="w-full flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Synthesizing...</span>
                </div>
            ) : isActive && audioBlob ? (
                /* Active: Interactive WaveSurfer */
                <WaveformPlayer blob={audioBlob} isActive={isActive} chunkId={chunk.id!} />
            ) : chunk.waveformPeaks ? (
                /* Inactive: Lightweight Static Canvas */
                <WaveformCanvas peaks={chunk.waveformPeaks} />
            ) : null}
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
                {isActive && isPlaying ? <PauseCircle /> : <PlayCircle />}
            </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
    return prev.isActive === next.isActive && 
           prev.chunk.status === next.chunk.status &&
           prev.chunk.textContent === next.chunk.textContent &&
           prev.chunk.waveformPeaks === next.chunk.waveformPeaks;
});