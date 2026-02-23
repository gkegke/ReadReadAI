import React, { useState, useEffect, memo, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { PlayCircle, PauseCircle, GripVertical, Settings2 } from 'lucide-react';
import { useServices } from '../../../shared/context/ServiceContext';
import { WaveformPlayer } from './WaveformPlayer';
import { WaveformCanvas } from './WaveformCanvas';
import { PlaybackState } from '../services/AudioPlaybackService';
import { useUpdateChunkTextMutation } from '../../../shared/hooks/useMutations';
import { cn } from '../../../shared/lib/utils';
import type { Chunk } from '../../../shared/types/schema';

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
}

/**
 * ChunkItem (V3.0 - The Invisible Editor)
 * [CRITICAL: 10/10] Minimalist aesthetic that emphasizes content over UI.
 * Controls are revealed only on hover to prevent visual exhaustion.
 */
export const ChunkItem = memo(({ chunk, isActive }: ChunkItemProps) => {
  const { playbackState, isPlaying: isGlobalPlaying } = useAudioStore();
  const { isZenMode } = useSystemStore();
  const { playback, storage } = useServices();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: chunk.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(chunk.textContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mutate: updateText, isPending: isSaving } = useUpdateChunkTextMutation();

  const isPlaying = isActive && playbackState === PlaybackState.PLAYING;
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

  const handleSave = () => {
      if (editText !== chunk.textContent) {
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
        ref={setNodeRef}
        style={style}
        className={cn(
            "group relative pl-20 pr-12 py-10 transition-all duration-700 ease-out rounded-[2rem]",
            isActive ? "bg-primary/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] scale-[1.01]" : "hover:bg-secondary/5",
            isDimmed && "opacity-10 blur-[3px] grayscale pointer-events-none scale-[0.98]",
            isDragging && "opacity-50 scale-[1.05] shadow-2xl bg-primary/10"
        )}
    >
      {/* Refined drag handle positioning */}
      <button 
        {...attributes} 
        {...listeners}
        className="absolute left-8 top-12 p-2 opacity-0 group-hover:opacity-20 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-primary"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="relative">
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    autoFocus
                    className="w-full bg-transparent border-none p-0 text-2xl font-serif leading-[1.7] focus:outline-none resize-none overflow-hidden"
                    value={editText}
                    onChange={(e) => {
                        setEditText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={handleSave}
                />
            ) : (
                <p 
                    onDoubleClick={() => setIsEditing(true)}
                    className={cn(
                        "text-2xl font-serif leading-[1.7] transition-all duration-500 cursor-text selection:bg-primary/20",
                        isActive ? "text-foreground font-medium" : "text-foreground/80"
                    )}
                >
                    {chunk.textContent}
                </p>
            )}
      </div> 
        
      {/* [HOVER REVEAL] Footer Metadata & Controls */}
      <div className={cn(
          "h-12 mt-4 flex items-center gap-6 transition-all duration-500 ease-in-out",
          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
      )}>
            <div className="flex-1">
                {chunk.status === 'processing' || isSaving ? (
                    <div className="w-full h-[2px] bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-shimmer w-full" />
                    </div>
                ) : isActive && audioBlob ? (
                    <WaveformPlayer blob={audioBlob} isActive={isActive} chunkId={chunk.id!} />
                ) : chunk.waveformPeaks ? (
                    <div className="opacity-40 hover:opacity-100 transition-opacity">
                        <WaveformCanvas peaks={chunk.waveformPeaks} height={24} color="currentColor" />
                    </div>
                ) : (
                    <div className="w-full h-[1px] bg-border/10" />
                )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Settings2 className="w-4 h-4 opacity-40 hover:opacity-100" />
                </button>
                <div className="h-4 w-[1px] bg-border/20" />
                <button 
                    onClick={handlePlay} 
                    disabled={chunk.status !== 'generated'}
                    className={cn(
                        "transition-all hover:scale-110 active:scale-95 disabled:opacity-10",
                        isPlaying ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )}
                >
                    {isPlaying ? <PauseCircle className="w-9 h-9" /> : <PlayCircle className="w-9 h-9" />}
                </button>
            </div>
      </div>
    </div>
  );
});