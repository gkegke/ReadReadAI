import React, { useState, useEffect, memo, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { PlayCircle, PauseCircle, Loader2, Edit3, Check, GripVertical } from 'lucide-react';
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

export const ChunkItem = memo(({ chunk, isActive }: ChunkItemProps) => {
  const { playbackState, isPlaying: isGlobalPlaying } = useAudioStore();
  const { isZenMode } = useSystemStore();
  const { playback, storage, logger } = useServices();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // [EPIC 3: Drag & Drop Support]
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
            "group relative pl-12 pr-4 py-6 transition-all duration-500 rounded-2xl",
            isActive ? "bg-secondary/20 shadow-inner" : "hover:bg-secondary/5",
            isDimmed && "opacity-20 blur-[1.5px] grayscale pointer-events-none scale-[0.98]",
            isDragging && "opacity-50 scale-105 shadow-2xl bg-primary/5"
        )}
    >
      {/* Tactical Drag Handle */}
      <button 
        {...attributes} 
        {...listeners}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-30 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="relative group/editor">
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    autoFocus
                    className="w-full bg-background border border-primary/30 rounded-lg p-2 text-xl font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                />
            ) : (
                <p 
                    onDoubleClick={() => setIsEditing(true)}
                    className={cn(
                        "text-xl font-serif leading-relaxed mb-6 cursor-text selection:bg-primary/20 transition-all",
                        isActive ? "text-primary font-medium tracking-wide" : "text-foreground/80"
                    )}
                >
                    {chunk.textContent}
                </p>
            )}
      </div>
        
      <div className="h-10 flex items-center gap-4">
            <div className="flex-1">
                {chunk.status === 'processing' || isSaving ? (
                    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-shimmer w-full" />
                    </div>
                ) : isActive && audioBlob ? (
                    <WaveformPlayer blob={audioBlob} isActive={isActive} chunkId={chunk.id!} />
                ) : chunk.waveformPeaks ? (
                    <div className="opacity-20"><WaveformCanvas peaks={chunk.waveformPeaks} height={32} /></div>
                ) : (
                    <div className="w-full h-[1px] bg-border/20" />
                )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-30">
                    {chunk.status}
                </span>
                <button 
                    onClick={handlePlay} 
                    disabled={chunk.status !== 'generated'}
                    className={cn(
                        "transition-all hover:scale-110 active:scale-90 disabled:opacity-10",
                        isPlaying ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )}
                >
                    {isPlaying ? <PauseCircle className="w-8 h-8" /> : <PlayCircle className="w-8 h-8" />}
                </button>
            </div>
      </div>
    </div>
  );
});