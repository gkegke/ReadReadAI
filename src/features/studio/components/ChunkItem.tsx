import React, { useState, useEffect, memo, useRef } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useSystemStore } from '../../../shared/store/useSystemStore'; // [EPIC 3]
import { PlayCircle, PauseCircle, Loader2, Edit3, Check } from 'lucide-react';
import { useServices } from '../../../shared/context/ServiceContext';
import { WaveformPlayer } from './WaveformPlayer';
import { WaveformCanvas } from './WaveformCanvas';
import { PlaybackState } from '../services/AudioPlaybackService';
import { useUpdateChunkTextMutation } from '../../../shared/hooks/useMutations';
import { cva } from 'class-variance-authority';
import { cn } from '../../../shared/lib/utils';
import type { Chunk } from '../../../shared/types/schema';

const chunkVariants = {
    container: cva(
        "group relative pl-6 border-l-2 py-4 transition-all duration-500 ease-in-out", // Added duration
        {
            variants: {
                active: { true: "border-primary", false: "border-transparent hover:border-border" }
            },
            defaultVariants: { active: false }
        }
    ),
    card: cva(
        "rounded-xl p-5 border transition-all duration-300",
        {
            variants: {
                active: { true: "bg-secondary/30 border-border shadow-sm", false: "border-transparent hover:bg-secondary/10" }
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
  const { playbackState, isPlaying: isGlobalPlaying } = useAudioStore();
  const { isZenMode } = useSystemStore(); // [EPIC 3] Zen Mode Consumption
  const { playback, storage, logger } = useServices();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // [Epic 4] Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(chunk.textContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mutate: updateText, isPending: isSaving } = useUpdateChunkTextMutation();

  const isPlaying = isActive && playbackState === PlaybackState.PLAYING;

  // [EPIC 3] Zen Mode Logic
  // If Zen mode is ON, and we are playing audio globally, and this item is NOT active...
  // ...then we dim it, blur it slightly, and grayscale it to reduce cognitive load.
  const isDimmed = isZenMode && isGlobalPlaying && !isActive;

  useEffect(() => {
      let isMounted = true;
      if (isActive && chunk.status === 'generated' && chunk.generatedFilePath) {
          storage.readFile(chunk.generatedFilePath).then(blob => {
              if (isMounted) setAudioBlob(blob);
          });
      }
      return () => { isMounted = false; };
  }, [isActive, chunk.generatedFilePath, chunk.status, storage]);

  // [Epic 4] Handle Auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editText]);

  const handleSave = () => {
      if (editText !== chunk.textContent) {
          logger.info('Editor', `Updating chunk ${chunk.id}`, { length: editText.length });
          updateText({ id: chunk.id!, text: editText });
      }
      setIsEditing(false);
  };

  const handlePlay = async () => {
      if (isActive) {
          playback.toggle();
      } else {
          const blob = audioBlob || await storage.readFile(chunk.generatedFilePath!);
          playback.playChunk(chunk.id!, blob);
      }
  };

  return (
    <div 
        className={cn(
            chunkVariants.container({ active: isActive }),
            // [EPIC 3] Visual Application of Zen Mode
            isDimmed && "opacity-20 blur-[1px] grayscale scale-[0.99] pointer-events-none"
        )}
    >
      <div className={chunkVariants.card({ active: isActive })}>
        
        {/* [Epic 4] Contextual Editor UI */}
        <div className="relative group/editor">
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    autoFocus
                    className="w-full bg-background border border-primary/30 rounded-lg p-2 text-lg font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSave();
                        }
                    }}
                />
            ) : (
                <p 
                    onDoubleClick={() => setIsEditing(true)}
                    className={cn(
                        "text-lg font-serif leading-relaxed mb-4 cursor-text selection:bg-primary/10 transition-all",
                        // [EPIC 3] Active Font Scaling
                        isActive && isZenMode ? "text-xl font-medium tracking-wide" : ""
                    )}
                >
                    {chunk.textContent}
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="ml-2 opacity-0 group-hover/editor:opacity-40 hover:opacity-100 transition-opacity"
                    >
                        <Edit3 className="w-3.5 h-3.5 inline" />
                    </button>
                </p>
            )}
        </div>
        
        <div className="h-12 flex items-center">
            {chunk.status === 'processing' || isSaving ? (
                <div className="w-full flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        {isSaving ? 'Re-writing...' : 'Synthesizing...'}
                    </span>
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
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                    {chunk.status}
                </span>
                {chunk.status === 'generated' && <Check className="w-3 h-3 text-green-500" />}
            </div>
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