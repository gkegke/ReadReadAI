import React, { useState, memo } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useUIStore } from '../../../shared/store/useUIStore';
import {
    PlayCircle, PauseCircle, Settings2, Loader2, ArrowRightLeft, Check,
    Trash2, PenTool, RefreshCw, AlertCircle
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '../../../shared/components/ui/dropdown-menu';
import { PlaybackState } from '../services/AudioPlaybackService';
import {
    useUpdateChunkTextMutation,
    useDeleteChunksMutation,
    useRegenerateChunksMutation
} from '../../../shared/hooks/useMutations';
import { ChunkRepository } from '../api/ChunkRepository';
import { cn } from '../../../shared/lib/utils';
import { StudioBlockEditor } from './StudioBlockEditor';
import type { Chunk } from '../../../shared/types/schema';

interface ChunkItemProps {
  chunk: Chunk;
  isActive: boolean;
  index: number;
}

export const ChunkItem = memo(({ chunk, isActive, index }: ChunkItemProps) => {
  const { isZenMode } = useUIStore();
  const { togglePlay, playbackState, skipToChunk } = useAudioStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [targetPos, setTargetPos] = useState((index + 1).toString());
  const [editText, setEditText] = useState(chunk.textContent);

  const isPlaying = isActive && playbackState === PlaybackState.PLAYING;
  const isDimmed = isZenMode && playbackState === PlaybackState.PLAYING && !isActive;
  const isFailed = chunk.status === 'failed_tts';

  const { mutate: updateText, isPending: isUpdating } = useUpdateChunkTextMutation();
  const { mutate: deleteChunk } = useDeleteChunksMutation();
  const { mutate: regenerate } = useRegenerateChunksMutation();

  const handleReorder = async () => {
      const pos = parseInt(targetPos) - 1;
      if (isNaN(pos) || pos === index) { setIsMoving(false); return; }

      await ChunkRepository.update(chunk.id!, { orderInProject: pos });
      setIsMoving(false);

      // Auto scroll using native browser API since Virtuoso will reposition it
      document.getElementById(`chunk-${chunk.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div
        id={`chunk-${chunk.id}`}
        className={cn(
            "group/chunk relative pl-12 pr-12 py-8 transition-all duration-500 rounded-3xl border border-transparent overflow-hidden",
            isActive ? "bg-primary/[0.04] shadow-[0_0_40px_rgba(var(--primary),0.02)]" : "hover:bg-secondary/5",
            isEditing && "bg-background shadow-2xl scale-[1.02] z-20 border-primary/10",
            isDimmed && "opacity-10 blur-[3px] grayscale pointer-events-none",
            isFailed && "border-destructive/20 bg-destructive/[0.02]"
        )}>

      {isPlaying && (
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 animate-shimmer" />
      )}

      <button
          type="button"
          className="absolute left-0 top-0 bottom-0 w-12 flex flex-col items-center justify-center group/pos-zone cursor-pointer border-none bg-transparent"
          onClick={() => !isMoving && setIsMoving(true)}
      >
          <div className="absolute inset-y-4 left-2 w-1 bg-primary/0 group-hover/pos-zone:bg-primary/10 rounded-full transition-colors" />

          <div className="relative flex flex-col items-center gap-1">
              {isMoving ? (
                  <form
                    className="flex flex-col items-center gap-2 bg-background border rounded-lg p-1.5 shadow-2xl animate-in zoom-in-95 z-30"
                    onSubmit={(e) => { e.preventDefault(); handleReorder(); }}
                  >
                      <input
                        autoFocus
                        type="number"
                        value={targetPos}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setTargetPos(e.target.value)}
                        className="w-10 h-8 text-[10px] font-black text-center bg-secondary rounded focus:ring-1 ring-primary outline-none"
                      />
                      <button
                        type="submit"
                        onClick={e => e.stopPropagation()}
                        className="p-1 hover:text-green-600 transition-colors border-none bg-transparent cursor-pointer"
                      >
                          <Check className="w-3 h-3" />
                      </button>
                  </form>
              ) : (
                  <div className="flex flex-col items-center transition-all duration-300 group-hover/pos-zone:scale-110">
                      <span className="text-[10px] font-mono font-black opacity-10 group-hover/pos-zone:opacity-100 group-hover/pos-zone:text-primary">#{index + 1}</span>
                      <ArrowRightLeft className="w-3 h-3 opacity-0 group-hover/pos-zone:opacity-100 text-primary mt-1" />
                  </div>
              )}
          </div>
      </button>

      <div className="relative z-10">
            {isEditing ? (
                <StudioBlockEditor
                    value={editText}
                    onChange={setEditText}
                    isPending={isUpdating}
                    onSave={() => { updateText({ id: chunk.id!, text: editText }); setIsEditing(false); }}
                    onCancel={() => setIsEditing(false)}
                />
            ) : (
                <>
                    <p onDoubleClick={() => setIsEditing(true)} className={cn(
                            "text-2xl font-serif leading-relaxed transition-colors duration-700 cursor-text",
                            isPlaying ? "text-primary" : "text-foreground/90",
                            chunk.role === 'heading' && "font-black text-3xl font-sans",
                            isFailed && "opacity-50"
                        )}>
                        {chunk.textContent}
                    </p>
                    {isFailed && (
                        <div className="mt-2 flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Synthesis Failed: Invalid Output</span>
                        </div>
                    )}
                </>
            )}
      </div>

      {!isEditing && (
          <div className="mt-6 flex flex-col gap-4">
              <div className="h-8 flex items-center justify-between opacity-0 group-hover/chunk:opacity-100 transition-opacity">
                  <div className="flex-1 mr-8">
                      {chunk.status === 'processing' && <div className="h-0.5 w-full bg-primary/20 animate-pulse rounded-full" />}
                  </div>
                  <div className="flex items-center gap-4">
                      <DropdownMenu>
                          <DropdownMenuTrigger className="p-2 hover:bg-secondary rounded-lg transition-colors">
                              <Settings2 className="w-4 h-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setIsEditing(true)}><PenTool className="w-3.5 h-3.5 mr-2"/> Edit Content</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setIsMoving(true)}><ArrowRightLeft className="w-3.5 h-3.5 mr-2"/> Move Position</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => regenerate({ projectId: chunk.projectId, chunkIds: [chunk.id!] })}><RefreshCw className="w-3.5 h-3.5 mr-2"/> Force Regenerate</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onClick={() => deleteChunk({ projectId: chunk.projectId, chunkIds: [chunk.id!] })}><Trash2 className="w-3.5 h-3.5 mr-2"/> Delete Block</DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>

<button
    onClick={() => isActive ? togglePlay() : skipToChunk(chunk.id!)}
    className={cn(
        "text-primary transition-all active:scale-95 bg-transparent border-none cursor-pointer",
        isFailed && "opacity-20 grayscale"
    )}
>
    {chunk.status === 'processing' ? <Loader2 className="w-9 h-9 animate-spin text-muted-foreground" /> :
     isPlaying ? <PauseCircle className="w-9 h-9" /> : <PlayCircle className="w-9 h-9" />}
</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
});
