import React, { useState, useEffect, memo, useRef } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { 
    PlayCircle, PauseCircle, Settings2, Loader2, ArrowUp, ArrowDown, 
    SplitSquareVertical, FoldVertical, CheckSquare, Square, PenTool, RefreshCw
} from 'lucide-react';
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from '../../../shared/components/ui/dropdown-menu';
import { useServices } from '../../../shared/context/ServiceContext';
import { PlaybackState } from '../services/AudioPlaybackService';
import { 
    useUpdateChunkTextMutation, 
    useGenerateAudioMutation, 
    useSplitChunkMutation,
    useMergeChunkMutation 
} from '../../../shared/hooks/useMutations';
import { ChunkRepository } from '../api/ChunkRepository';
import { cn } from '../../../shared/lib/utils';
import { logger } from '../../../shared/services/Logger';
import type { Chunk } from '../../../shared/types/schema';

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
  index: number;
  totalChunks: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export const ChunkItem = memo(({ chunk, isActive, index, totalChunks, onMoveUp, onMoveDown }: ChunkItemProps) => {
  const { playbackState, setActiveChunkId } = useAudioStore();
  const { selectedChunkIds, toggleChunkSelection, isSelectionMode } = useProjectStore();
  
  const currentTime = useAudioStore(state => state.activeChunkId === chunk.id ? state.currentTime : 0);
  const duration = useAudioStore(state => state.activeChunkId === chunk.id ? state.duration : 0);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const { isZenMode } = useSystemStore();
  const { playback, storage } = useServices();
  
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isJitGenerating, setIsJitGenerating] = useState(false);
  
  const { mutateAsync: generateAudio } = useGenerateAudioMutation();
  const { mutate: splitChunk } = useSplitChunkMutation();
  const { mutate: mergeChunk } = useMergeChunkMutation();
  
  const isGlobalPlaying = playbackState === PlaybackState.PLAYING;
  const isSelected = selectedChunkIds.includes(chunk.id!);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(chunk.textContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mutate: updateText, isPending: isSaving } = useUpdateChunkTextMutation();

  const isPlaying = isActive && isGlobalPlaying;
  const isDimmed = isZenMode && isGlobalPlaying && !isActive;
  
  const isHeading = chunk.role === 'heading';

  // [UX] Auto-resize textarea on mount and edit
  useEffect(() => {
      if (isEditing && textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
  }, [isEditing, editText]);

  useEffect(() => {
      let isMounted = true;
      if (isActive && chunk.status === 'generated' && chunk.generatedFilePath) {
          storage.readFile(chunk.generatedFilePath).then(blob => {
              if (isMounted) setAudioBlob(blob);
          }).catch(e => {
              logger.warn('ChunkItem', 'Failed to auto-buffer active chunk audio', e);
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

  const handleSplit = () => {
      let cursor = Math.floor(chunk.textContent.length / 2);
      if (isEditing && textareaRef.current) {
          cursor = textareaRef.current.selectionStart;
      }
      splitChunk({ id: chunk.id!, cursor });
      setIsEditing(false);
  };

  const handlePlay = async () => {
      if (isActive) {
          playback.toggle();
          return;
      }

      setActiveChunkId(chunk.id!);

      const attemptPlayback = async (filePath: string) => {
          const blob = audioBlob || await storage.readFile(filePath);
          playback.playChunk(chunk.id!, blob);
      };

      if (chunk.status !== 'generated' || !chunk.generatedFilePath) {
          try {
              setIsJitGenerating(true);
              await generateAudio(chunk.id!);
              
              const freshChunk = await ChunkRepository.get(chunk.id!);
              if (freshChunk?.generatedFilePath) {
                  await attemptPlayback(freshChunk.generatedFilePath);
              }
          } catch (err) {
              logger.error('ChunkItem', 'JIT Playback failed', err);
          } finally {
              setIsJitGenerating(false);
          }
      } else {
          try {
              await attemptPlayback(chunk.generatedFilePath);
          } catch(e) {
              setIsJitGenerating(true);
              try {
                  await generateAudio(chunk.id!);
                  const freshChunk = await ChunkRepository.get(chunk.id!);
                  if (freshChunk?.generatedFilePath) await attemptPlayback(freshChunk.generatedFilePath);
              } catch (regenErr) {
                  logger.error('ChunkItem', 'Healing regeneration failed', regenErr);
              } finally {
                  setIsJitGenerating(false);
              }
          }
      }
  };

  const handleCardClick = (e: React.MouseEvent) => {
      if (isSelectionMode) {
          e.preventDefault();
          e.stopPropagation();
          toggleChunkSelection(chunk.id!);
      }
  };

  return (
    <div 
        onClick={handleCardClick}
        className={cn(
            "group relative pl-12 pr-12 transition-all duration-700 ease-out rounded-[2rem] border border-transparent",
            isActive ? "bg-primary/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] scale-[1.01]" : "hover:bg-secondary/5",
            isSelectionMode && "cursor-pointer hover:border-primary/30",
            isSelected && "bg-primary/5 border-primary/50 shadow-sm",
            isDimmed && "opacity-10 blur-[3px] grayscale pointer-events-none scale-[0.98]",
            isHeading ? "py-14 mt-8" : "py-10"
        )}
    >
        {isSelectionMode ? (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                {isSelected ? <CheckSquare className="w-5 h-5 text-primary"/> : <Square className="w-5 h-5 text-muted-foreground opacity-30"/>}
            </div>
        ) : (
            <div className={cn("absolute left-4 opacity-10 group-hover:opacity-100 transition-opacity text-[9px] font-mono font-bold select-none text-muted-foreground", isHeading ? "top-16" : "top-12")}>
                #{index + 1}
            </div>
        )}

      <div className={cn("relative", isSelectionMode && "pointer-events-none")}>
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    autoFocus
                    className={cn("w-full bg-transparent border-none p-0 focus:outline-none resize-none overflow-hidden", isHeading ? "text-3xl font-black font-sans leading-tight tracking-tight" : "text-2xl font-serif leading-[1.7]")}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                />
            ) : (
                <p 
                    onDoubleClick={() => { if (!isSelectionMode) setIsEditing(true); }}
                    className={cn(
                        "transition-all duration-500 selection:bg-primary/20",
                        !isSelectionMode && "cursor-text",
                        isActive ? "text-foreground font-medium" : "text-foreground/80",
                        isHeading ? "text-3xl font-black font-sans leading-tight tracking-tight text-primary/90" : "text-2xl font-serif leading-[1.7]"
                    )}
                >
                    {chunk.textContent}
                </p>
            )}
      </div> 
        
      <div className={cn(
          "h-12 mt-4 flex items-center gap-6 transition-all duration-500 ease-in-out",
          isActive ? "opacity-100" : "opacity-30 group-hover:opacity-100",
          isSelectionMode && "pointer-events-none opacity-20"
      )}>
            <div className="flex-1">
                {chunk.status === 'processing' || isSaving || isJitGenerating ? (
                    <div className="w-full h-[2px] bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-shimmer w-full" />
                    </div>
                ) : chunk.status === 'failed_tts' ? (
                    <div className="w-full h-[1px] bg-destructive/50" />
                ) : isActive && audioBlob ? (
                    <div className="w-full h-8 mt-2 bg-secondary/10 rounded-lg overflow-hidden relative cursor-default border border-border/20">
                        <div
                            className="absolute top-0 left-0 h-full bg-primary/20 transition-all duration-100 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                        <div
                            className="absolute top-0 left-0 h-full border-r-[3px] border-primary transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(var(--primary),0.6)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                ) : (
                    <div className="w-full h-[1px] bg-border/10" />
                )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                            <Settings2 className="w-4 h-4 opacity-40 hover:opacity-100" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setIsEditing(true)}>
                            <PenTool className="w-3.5 h-3.5 mr-2" /> Edit Text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSplit}>
                            <SplitSquareVertical className="w-3.5 h-3.5 mr-2" /> Split Block
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mergeChunk(chunk.id!)} disabled={index === totalChunks - 1}>
                            <FoldVertical className="w-3.5 h-3.5 mr-2" /> Merge Down
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onMoveUp(index)} disabled={index === 0}>
                            <ArrowUp className="w-3.5 h-3.5 mr-2" /> Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMoveDown(index)} disabled={index === totalChunks - 1}>
                            <ArrowDown className="w-3.5 h-3.5 mr-2" /> Move Down
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => generateAudio(chunk.id!)}>
                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Regenerate Audio
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-[1px] bg-border/20" />
                
                {chunk.status === 'failed_tts' ? (
                     <button 
                        onClick={() => generateAudio(chunk.id!)} 
                        title="Retry Synthesis"
                        className="transition-all hover:scale-110 active:scale-95 text-destructive hover:text-destructive/80"
                    >
                        <RefreshCw className="w-7 h-7" />
                    </button>
                ) : (
                    <button 
                        onClick={handlePlay} 
                        disabled={isJitGenerating}
                        className={cn(
                            "transition-all hover:scale-110 active:scale-95 disabled:opacity-50",
                            isPlaying ? "text-primary" : "text-muted-foreground hover:text-primary"
                        )}
                    >
                        {isJitGenerating ? (
                            <Loader2 className="w-9 h-9 animate-spin" />
                        ) : isPlaying ? (
                            <PauseCircle className="w-9 h-9" />
                        ) : (
                            <PlayCircle className="w-9 h-9" />
                        )}
                    </button>
                )}
            </div>
      </div>
    </div>
  );
});