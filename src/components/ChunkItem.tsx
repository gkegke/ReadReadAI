import React, { useState, useEffect } from 'react';
import { useChunk, useProjectChunkIds } from '../hooks/useQueries';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { useAudioStore } from '../store/useAudioStore';
import { 
    useUpdateChunkTextMutation, 
    useGenerateAudioMutation 
} from '../hooks/useMutations';
import { Edit2, PlayCircle, PauseCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { storage } from '../services/storage';
import { db } from '../db';
import { WaveformPlayer } from './WaveformPlayer';

interface ChunkItemProps {
  chunkId: number;
  isLast: boolean;
  isActive: boolean;
}

export const ChunkItem: React.FC<ChunkItemProps> = ({ chunkId, isActive }) => {
  const { data: chunk, isLoading } = useChunk(chunkId);
  const { setActiveChunkId, isPlaying, setIsPlaying, setQueue, playNext } = useAudioStore();
  const { data: allChunkIds } = useProjectChunkIds(chunk?.projectId || null);
  
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
      if (chunk?.status === 'generated' && chunk.cleanTextHash) {
          db.audioCache.get(chunk.cleanTextHash).then(meta => {
              if (meta) storage.readFile(meta.path).then(setAudioBlob);
          });
      } else {
          setAudioBlob(null);
      }
  }, [chunk?.status, chunk?.cleanTextHash]);

  const updateText = useUpdateChunkTextMutation();
  const generateAudio = useGenerateAudioMutation();

  if (isLoading || !chunk) return <div className="h-24 animate-pulse bg-secondary/20 rounded-md my-2" />;

  const handlePlayClick = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isActive) {
          setIsPlaying(!isPlaying);
          return;
      }
      if (chunk.status === 'pending' || chunk.status === 'failed_tts') {
          generateAudio.mutate(chunk.id!);
      }
      if (allChunkIds) setQueue(allChunkIds);
      setActiveChunkId(chunk.id!);
      setIsPlaying(true);
  };

  const isProcessing = chunk.status === 'processing' || updateText.isPending;

  return (
    <div className={cn("group relative pl-6 border-l-2 py-3 transition-colors", isActive ? "border-primary" : "border-border hover:border-primary/50")}>
      
      <div onClick={handlePlayClick} className={cn("absolute -left-[9px] top-5 w-4 h-4 rounded-full border-2 transition-all z-10 cursor-pointer flex items-center justify-center shadow-sm", isActive ? "bg-primary border-primary scale-125" : "bg-background border-border")}>
          {isActive && isPlaying && <div className="w-1.5 h-1.5 bg-background rounded-full animate-pulse" />}
      </div>

      <div className={cn("rounded-md p-4 -ml-3 transition-colors border relative overflow-hidden", isActive ? "bg-secondary/40 border-border shadow-inner" : "hover:bg-secondary/10 border-transparent")}>
        
        {isEditing ? (
            <textarea 
                value={editText} 
                onChange={(e) => setEditText(e.target.value)} 
                onBlur={() => {
                    if (editText !== chunk.textContent) updateText.mutate({ id: chunk.id!, text: editText });
                    setIsEditing(false);
                }}
                className="w-full min-h-[100px] p-3 rounded-md border bg-background font-serif" 
                autoFocus 
            />
        ) : (
            <>
                <p className={cn("text-lg leading-relaxed font-serif cursor-pointer", isActive ? "text-foreground" : "text-foreground/80")} onClick={() => { setEditText(chunk.textContent); setIsEditing(true); }}>
                    {chunk.textContent}
                </p>

                {audioBlob && (
                    <div className={cn("transition-opacity duration-500", isActive ? "opacity-100" : "opacity-40 grayscale group-hover:grayscale-0")}>
                        <WaveformPlayer 
                            blob={audioBlob} 
                            isActive={isActive} 
                            onEnded={playNext} 
                        />
                    </div>
                )}
            </>
        )}

        <div className="flex items-center justify-between mt-3 h-6">
            <div className="flex items-center gap-3">
                    {isProcessing && <span className="text-xs text-primary animate-pulse font-bold">SYNTHESIZING...</span>}
            </div>

            <div className={cn("flex items-center gap-1 transition-opacity", isActive || isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                <button onClick={handlePlayClick} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                    {isActive && isPlaying ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditText(chunk.textContent); setIsEditing(!isEditing); }} className="p-1.5 text-muted-foreground hover:text-primary">
                    <Edit2 className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};