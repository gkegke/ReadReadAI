import React from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunkIds } from '../../../shared/hooks/useQueries';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

export const PlayerControls: React.FC = () => {
  const { isPlaying, togglePlay, activeChunkId, setActiveChunkId, playbackSpeed, setPlaybackSpeed, currentTime, duration } = useAudioStore();
  const { activeProjectId } = useProjectStore();
  
  // Use IDs instead of full objects
  const { data: chunkIds } = useProjectChunkIds(activeProjectId);

  if (!activeProjectId || !chunkIds || chunkIds.length === 0) return null;

  const currentChunkIndex = activeChunkId ? chunkIds.indexOf(activeChunkId) : -1;
  const hasPrev = currentChunkIndex > 0;
  const hasNext = currentChunkIndex < chunkIds.length - 1;

  const handlePrev = () => { if (hasPrev) setActiveChunkId(chunkIds[currentChunkIndex - 1]); };
  const handleNext = () => { if (hasNext) setActiveChunkId(chunkIds[currentChunkIndex + 1]); };
  
  const toggleSpeed = () => {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
      const idx = speeds.indexOf(playbackSpeed);
      setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  };

  const formatTime = (t: number) => {
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-background/95 backdrop-blur border-t border-border p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
      <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col min-w-[200px]">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Now Playing</span>
              <span className="text-sm font-medium truncate max-w-[300px]">
                  {activeChunkId ? `Chunk #${currentChunkIndex + 1}` : 'Select a chunk'}
              </span>
          </div>
          
          <div className="flex items-center gap-6">
             <button onClick={handlePrev} disabled={!hasPrev} className="text-foreground/70 hover:text-foreground disabled:opacity-30"><SkipBack className="w-6 h-6" fill="currentColor" /></button>
             <button onClick={togglePlay} disabled={!activeChunkId} className={cn("w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all", isPlaying ? "bg-secondary text-foreground" : "bg-foreground text-background")}>
                 {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
             </button>
             <button onClick={handleNext} disabled={!hasNext} className="text-foreground/70 hover:text-foreground disabled:opacity-30"><SkipForward className="w-6 h-6" fill="currentColor" /></button>
          </div>

          <div className="flex items-center justify-end min-w-[200px]">
              <button onClick={toggleSpeed} className="text-xs font-mono font-medium px-3 py-1 bg-secondary rounded hover:bg-secondary/80 w-16">{playbackSpeed}x</button>
          </div>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-linear" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} 
              />
          </div>
          <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};