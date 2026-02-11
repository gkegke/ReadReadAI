import React, { useEffect, useRef, useState } from 'react';
import { ChunkItem } from './ChunkItem';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectChunks } from '../hooks/useQueries'; 
import { useImportTextMutation, useImportDocumentMutation } from '../hooks/useMutations';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Send, Upload, Loader2, Plus } from 'lucide-react';
import { AppErrorBoundary } from './AppErrorBoundary';

export const Timeline: React.FC = () => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId } = useProjectStore();
  
  // Pivot: Fetch ALL chunks for the project in one reactive query
  const { data: chunks, isLoading } = useProjectChunks(activeProjectId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [inputValue, setInputValue] = useState('');
  
  const { mutate: importText, isPending: isImportingText } = useImportTextMutation();
  const { mutate: importDoc, isPending: isImportingDoc } = useImportDocumentMutation();
  
  const isImporting = isImportingText || isImportingDoc;

  useEffect(() => {
    if (activeChunkId && virtuosoRef.current && chunks) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-50">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading Chunks...</p>
      </div>
  );

  return (
    <div className="h-full w-full flex flex-col">
        {/* Input Header */}
        <div className="max-w-3xl w-full mx-auto px-6 py-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md">
            <div className="relative group shadow-sm rounded-xl border border-border bg-card">
                <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Paste text to generate audio..."
                    className="w-full min-h-[100px] p-4 pb-12 rounded-xl bg-transparent text-lg font-serif resize-none focus:outline-none"
                    disabled={isImporting}
                />
                <button 
                    onClick={() => { importText(inputValue); setInputValue(''); }}
                    disabled={!inputValue.trim() || isImporting}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>GENERATE</span>
                </button>
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
                components={{ Footer: () => <div className="h-48" /> }}
                style={{ height: '100%' }}
            />
        </AppErrorBoundary>
    </div>
  );
};