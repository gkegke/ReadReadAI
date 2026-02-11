import React, { useState, useEffect, memo } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { useUpdateChunkTextMutation } from '../hooks/useMutations';
import { PlayCircle, PauseCircle, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { storage } from '../services/storage';
import { WaveformPlayer } from './WaveformPlayer';
import { audioPlaybackService } from '../services/AudioPlaybackService';
import type { Chunk } from '../types/schema';

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
}

/**
 * React.memo is critical here. 
 * Since Timeline now passes the full chunk object, we only re-render 
 * if this specific chunk or its active status changes.
 */
export const ChunkItem = memo(({ chunk, isActive }: ChunkItemProps) => {
  const { isPlaying } = useAudioStore();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  useEffect(() => {
      if (chunk.status === 'generated' && chunk.generatedFilePath) {
          storage.readFile(chunk.generatedFilePath).then(setAudioBlob).catch(() => setAudioBlob(null));
      } else {
          setAudioBlob(null);
      }
  }, [chunk.generatedFilePath, chunk.status]);

  const handlePlay = () => {
      if (isActive) {
          audioPlaybackService.toggle();
      } else if (audioBlob) {
          audioPlaybackService.playChunk(chunk.id!, audioBlob);
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
        
        {audioBlob && (
            <div className={cn("transition-opacity", isActive ? "opacity-100" : "opacity-40 group-hover:opacity-100")}>
                <WaveformPlayer blob={audioBlob} isActive={isActive} chunkId={chunk.id!} />
            </div>
        )}

        <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {chunk.status === 'processing' ? 'Synthesizing...' : chunk.status}
            </span>
            <button onClick={handlePlay} className="text-primary hover:scale-110 transition-transform">
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
           prev.chunk.generatedFilePath === next.chunk.generatedFilePath;
});