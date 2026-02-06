import React, { useState, useRef, useEffect } from 'react';
import { useChunk, useProjectChunkIds } from '../hooks/useQueries';
import { ProjectActions } from '../services/ProjectActions';
import { useAudioStore } from '../store/useAudioStore';
import { useTTSStore } from '../store/useTTSStore';
import { Edit2, Save, X, Split, Merge, PlayCircle, Loader2, AlertCircle, Download, Plus, Mic2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChunkItemProps {
  chunkId: number;
  isLast: boolean;
  isActive: boolean;
}

export const ChunkItem: React.FC<ChunkItemProps> = ({ chunkId, isLast, isActive }) => {
  const { data: chunk, isLoading } = useChunk(chunkId);
  
  const { setActiveChunkId, isPlaying, setIsPlaying, setQueue } = useAudioStore();
  const { availableVoices } = useTTSStore();
  const { data: allChunkIds } = useProjectChunkIds(chunk?.projectId || null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [editText, setEditText] = useState('');
  const [insertText, setInsertText] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if(chunk) setEditText(chunk.textContent);
  }, [chunk]);

  useEffect(() => {
      if (isInserting && insertInputRef.current) insertInputRef.current.focus();
  }, [isInserting]);

  if (isLoading || !chunk) return <div className="h-24 animate-pulse bg-secondary/20 rounded-md my-2" />;

  const handleSave = async () => {
    if (editText.trim() !== chunk.textContent) {
      await ProjectActions.updateChunkText(chunk.id!, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(chunk.textContent);
    setIsEditing(false);
  };

  const handleSplit = async () => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    if (cursor > 0 && cursor < editText.length) {
        if (editText !== chunk.textContent) await ProjectActions.updateChunkText(chunk.id!, editText);
        await ProjectActions.splitChunk(chunk.id!, cursor);
        setIsEditing(false); 
    } else {
        textareaRef.current.focus();
    }
  };

  const handleInsert = async () => {
      if (!insertText.trim()) return;
      await ProjectActions.insertChunks(chunk.id!, insertText);
      setIsInserting(false);
      setInsertText('');
  };

  const handlePlayClick = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      
      if (isActive) {
          setIsPlaying(!isPlaying);
          return;
      }

      if (chunk.status === 'pending' || chunk.status === 'failed_tts') {
          ProjectActions.generateChunkAudio(chunk.id!);
      }

      if (allChunkIds) {
          setQueue(allChunkIds);
      }

      setActiveChunkId(chunk.id!);
      setIsPlaying(true);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation(); 
      const newVoiceId = e.target.value;
      if (newVoiceId) {
          ProjectActions.updateChunkOverride(chunk.id!, { voiceId: newVoiceId });
      }
  };

  const isProcessing = chunk.status === 'processing';
  const isFailed = chunk.status === 'failed_tts';
  const isGenerated = chunk.status === 'generated';
  const hasOverride = !!chunk.voiceOverride?.voiceId;

  return (
    <div className={cn("group relative pl-6 border-l-2 py-3 transition-colors", isActive ? "border-primary" : "border-border hover:border-primary/50")}>
      
      {/* Play/Status Indicator */}
      <div onClick={handlePlayClick} className={cn("absolute -left-[9px] top-5 w-4 h-4 rounded-full border-2 transition-all z-10 cursor-pointer flex items-center justify-center shadow-sm", isActive ? "bg-primary border-primary scale-125" : isGenerated ? "bg-green-100 border-green-500 hover:scale-110" : isProcessing ? "bg-secondary border-primary animate-pulse" : isFailed ? "bg-red-100 border-destructive" : "bg-background border-border group-hover:border-primary/50")}>
          {isActive && isPlaying && <div className="w-1.5 h-1.5 bg-background rounded-full animate-pulse" />}
          {isFailed && <span className="text-[8px] text-destructive font-bold">!</span>}
      </div>

      <div className={cn("rounded-md p-4 -ml-3 transition-colors border relative overflow-hidden", isActive ? "bg-secondary/40 border-border" : "hover:bg-secondary/20 border-transparent")}>
        {isProcessing && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary">
                <div className="h-full w-full animate-shimmer bg-primary/20"></div>
            </div>
        )}

        {isEditing ? (
            <div className="space-y-3 relative z-20">
                <textarea ref={textareaRef} value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-base font-serif resize-y focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90"><Save className="w-3.5 h-3.5" /> Save & Generate</button>
                    <button onClick={handleSplit} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground border border-input rounded text-xs font-medium hover:bg-secondary/80"><Split className="w-3.5 h-3.5" /> Split</button>
                    <div className="flex-1" />
                    <button onClick={handleCancel} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs"><X className="w-3.5 h-3.5" /> Cancel</button>
                </div>
            </div>
        ) : (
            <>
                <p className={cn("text-lg leading-relaxed font-serif cursor-pointer transition-opacity relative z-10", isActive ? "text-foreground font-medium" : "text-foreground/80 hover:text-foreground", isProcessing && "opacity-70")} onClick={() => !isProcessing && setIsEditing(true)}>
                    {chunk.textContent}
                </p>

                <div className="flex items-center justify-between mt-3 h-6 relative z-10">
                    <div className="flex items-center gap-3">
                         {isProcessing ? (
                             <span className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>
                         ) : isFailed ? (
                             <button onClick={() => ProjectActions.generateChunkAudio(chunk.id!)} className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium bg-destructive/10 px-2 py-0.5 rounded"><AlertCircle className="w-3 h-3" /> Retry</button>
                         ) : (
                             <div className={cn("flex items-center gap-1 transition-opacity", hasOverride ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                <div className={cn("flex items-center bg-secondary rounded-md px-1.5 py-0.5 border", hasOverride ? "border-primary/30 bg-primary/5" : "border-transparent")}>
                                    <Mic2 className={cn("w-3 h-3 mr-1", hasOverride ? "text-primary" : "text-muted-foreground")} />
                                    <select 
                                        className="bg-transparent text-[10px] font-medium focus:outline-none max-w-[100px] truncate cursor-pointer"
                                        value={chunk.voiceOverride?.voiceId || ''}
                                        onChange={handleVoiceChange}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="">(Default)</option>
                                        {availableVoices.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                             </div>
                         )}
                    </div>

                    <div className={cn("flex items-center gap-1 transition-opacity duration-200", isActive || isEditing || isInserting ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                        {isGenerated && (
                            <button onClick={() => ProjectActions.downloadChunkAudio(chunk.id!)} className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-secondary transition-colors" title="Download Audio">
                                <Download className="w-4 h-4" />
                            </button>
                        )}
                        {!isActive && (
                            <button onClick={handlePlayClick} className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-secondary transition-colors" title="Play"><PlayCircle className="w-4 h-4" /></button>
                        )}
                        
                        <button onClick={() => setIsInserting(!isInserting)} disabled={isProcessing} className={cn("p-1.5 rounded transition-colors disabled:opacity-30", isInserting ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-primary hover:bg-secondary")} title="Insert Text Below">
                            <Plus className="w-4 h-4" />
                        </button>

                        <button onClick={() => setIsEditing(true)} disabled={isProcessing} className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-secondary transition-colors disabled:opacity-30"><Edit2 className="w-4 h-4" /></button>
                        {!isLast && (
                            <button onClick={() => ProjectActions.mergeChunkWithNext(chunk.id!)} disabled={isProcessing} className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-secondary transition-colors disabled:opacity-30"><Merge className="w-4 h-4" /></button>
                        )}
                    </div>
                </div>
            </>
        )}
      </div>

      {isInserting && (
          <div className="mt-2 mb-2 p-3 border border-dashed border-primary/40 rounded-md bg-secondary/10 ml-0 animate-in fade-in slide-in-from-top-1 duration-200">
              <textarea 
                ref={insertInputRef}
                value={insertText} 
                onChange={(e) => setInsertText(e.target.value)} 
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm font-serif resize-y focus:outline-none focus:ring-2 focus:ring-ring" 
                placeholder="Type text to insert here..."
              />
              <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsInserting(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  <button onClick={handleInsert} disabled={!insertText.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50">
                      <Plus className="w-3.5 h-3.5" /> Insert & Generate
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};