import React, { useEffect, useRef, useState } from 'react';
import { ChunkItem } from './ChunkItem';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries'; 
import { useImportTextMutation } from '../../../shared/hooks/useMutations';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Send, Loader2, Type } from 'lucide-react';
import { AppErrorBoundary } from '../../../shared/components/AppErrorBoundary';

export const Timeline: React.FC = () => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, activeChapterId } = useProjectStore();
  
  // [EPIC 2] Filtered data based on scoped selection
  const { data: chunks, isLoading } = useProjectChunks(activeProjectId, activeChapterId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [inputValue, setInputValue] = useState('');
  
  const { mutate: importText, isPending: isImporting } = useImportTextMutation();

  useEffect(() => {
    if (activeChunkId && virtuosoRef.current && chunks) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  const handleGenerate = () => {
      if (!inputValue.trim()) return;
      importText(inputValue, {
          onSuccess: () => setInputValue('')
      });
  };

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-30">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Hydrating Studio</span>
      </div>
  );

  return (
    <div className="h-full w-full flex flex-col bg-background/50">
        <div className="max-w-3xl w-full mx-auto px-6 py-8 z-10 sticky top-0">
            <div className="relative group shadow-2xl rounded-2xl border border-border bg-card/50 backdrop-blur-xl focus-within:border-primary/50 transition-all">
                <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type or paste content to synthesize..."
                    className="w-full min-h-[120px] p-5 pb-14 rounded-2xl bg-transparent text-lg font-serif resize-none focus:outline-none placeholder:opacity-30"
                    disabled={isImporting}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                    {isImporting && (
                         <div className="flex items-center gap-2 text-primary animate-pulse mr-2">
                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                             <span className="text-[10px] font-bold uppercase">Chunking...</span>
                         </div>
                    )}
                    <button 
                        onClick={handleGenerate}
                        disabled={!inputValue.trim() || isImporting}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20"
                    >
                        <Send className="w-3.5 h-3.5" />
                        <span>SYNTHESIZE</span>
                    </button>
                </div>
                <div className="absolute bottom-4 left-5 opacity-20 group-focus-within:opacity-40 transition-opacity">
                    <Type className="w-4 h-4" />
                </div>
            </div>
        </div>

        <AppErrorBoundary name="TimelineList">
            <Virtuoso
                ref={virtuosoRef}
                data={chunks}
                itemContent={(index, chunk) => (
                    <div className="max-w-3xl mx-auto w-full px-6">
                        <ChunkItem 
                            chunk={chunk}
                            isActive={activeChunkId === chunk.id}
                        />
                    </div>
                )}
                components={{ Footer: () => <div className="h-64" /> }}
                style={{ height: '100%' }}
                className="scrollbar-hide"
            />
        </AppErrorBoundary>
    </div>
  );
};