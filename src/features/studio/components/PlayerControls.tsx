import React from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useUIStore } from '../../../shared/store/useUIStore';
import { useProjectChunkIds } from '../../../shared/hooks/useQueries';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Music2, Activity } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

export const PlayerControls: React.FC = () => {
  const { isPlaying, togglePlay, activeChunkId, skipToChunk, playbackRate, setPlaybackSpeed, currentTime, duration } = useAudioStore();
  const { activeProjectId } = useProjectStore();
  const { isPlayerOpen, togglePlayer } = useUIStore();

  const { data: chunkIds } = useProjectChunkIds(activeProjectId);

  if (!activeProjectId || !chunkIds) return null;

  const currentChunkIndex = activeChunkId ? chunkIds.indexOf(activeChunkId) : -1;
  const hasPrev = currentChunkIndex > 0;
  const hasNext = currentChunkIndex < chunkIds.length - 1;
  const hasChunks = chunkIds.length > 0;

  const handlePrev = () => { if (hasPrev) skipToChunk(chunkIds[currentChunkIndex - 1]); };
  const handleNext = () => { if (hasNext) skipToChunk(chunkIds[currentChunkIndex + 1]); };

  const toggleSpeed = () => {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
      const idx = speeds.indexOf(playbackRate);
      setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  };

  const formatTime = (t: number) => {
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

      return (
    <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 transition-all duration-700 ease-in-out",
        isPlayerOpen ? "pb-6" : "translate-y-[calc(100%-0px)] hover:translate-y-[calc(100%-10px)]"
    )}>
        {/* --- MINIMIZED PEEK TAB --- */}
        {!isPlayerOpen && (
            <div
            onClick={togglePlayer}
                className="mx-auto w-40 h-3 flex flex-col items-center justify-start cursor-pointer group"
            >
                <div className="w-12 h-1 bg-primary/20 rounded-full group-hover:bg-primary/50 transition-colors" />
                <div className="mt-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-t-xl flex items-center gap-2 border-x border-t border-white/10">
                    {isPlaying ? (
                        <Activity className="w-3 h-3 animate-pulse text-green-400" />
                    ) : (
                        <Music2 className="w-3 h-3" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-tighter">
                        {isPlaying ? "Playing" : "Paused"}
                  </span>
              </div>
            </div>
        )}

        <div className={cn(
            "glass-panel rounded-3xl p-4 shadow-[0_-5px_100px_rgba(0,0,0,0.1)] border border-white/10 relative overflow-hidden transition-opacity duration-500",
            !isPlayerOpen ? "opacity-20 pointer-events-none" : "opacity-100"
        )}>
            {/* Minimize Button - Now using a clearer "Down" intent */}
        <button
            onClick={togglePlayer}
                className="absolute top-2 right-4 p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                title="Minimize Console"
        >
                <ChevronDown className="w-5 h-5" strokeWidth={3} />
        </button>

      <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex flex-col min-w-[140px]">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Timeline</span>
              <span className="text-xs font-bold truncate opacity-80">
                  {activeChunkId
                    ? `Chunk ${currentChunkIndex + 1} of ${chunkIds.length}`
                    : hasChunks ? 'Ready to play' : 'Empty Project'}
              </span>
          </div>

          <div className="flex items-center gap-6">
             <button title="Previous Chunk (K)" onClick={handlePrev} disabled={!hasPrev} className="text-foreground/50 hover:text-foreground disabled:opacity-10 transition-colors"><SkipBack className="w-5 h-5" fill="currentColor" /></button>

             <button
                title="Play / Pause (Spacebar)"
                onClick={togglePlay}
                disabled={!hasChunks}
                className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl",
                    isPlaying ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
                    !hasChunks && "opacity-20 grayscale pointer-events-none"
                )}
             >
                 {isPlaying ? <Pause className="w-7 h-7" fill="currentColor" /> : <Play className="w-7 h-7 ml-1" fill="currentColor" />}
             </button>

             <button title="Next Chunk (J)" onClick={handleNext} disabled={!hasNext} className="text-foreground/50 hover:text-foreground disabled:opacity-10 transition-colors"><SkipForward className="w-5 h-5" fill="currentColor" /></button>
          </div>

          <div className="flex items-center justify-end min-w-[140px]">
              <button title="Playback Speed" onClick={toggleSpeed} className="text-[10px] font-black tracking-widest bg-primary/5 hover:bg-primary/10 px-4 py-1.5 rounded-full transition-colors">{playbackRate}X</button>
          </div>
      </div>

      <div className="flex items-center gap-4 px-2">
          <span className="text-[10px] font-mono opacity-40">{formatTime(currentTime)}</span>
          <div className="flex-1 h-1.5 bg-primary/5 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-primary transition-all duration-300 ease-linear shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
          </div>
          <span className="text-[10px] font-mono opacity-40">{formatTime(duration)}</span>
      </div>
    </div>
    </div>
  );
};
