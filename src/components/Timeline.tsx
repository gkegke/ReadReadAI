import React, { useEffect, useRef, useState } from 'react';
import { ChunkItem } from './ChunkItem';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectChunkIds } from '../hooks/useQueries';
import { useImportTextMutation, useImportDocumentMutation } from '../hooks/useMutations'; // Updated Import
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Plus, Send, Upload, Loader2 } from 'lucide-react';
import { AppErrorBoundary } from './AppErrorBoundary';
import App from '../App';

interface TimelineProps {
  header?: React.ReactNode; 
}

export const Timeline: React.FC<TimelineProps> = ({ header }) => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId } = useProjectStore();
  
  const { data: chunkIds, isLoading: isChunksLoading } = useProjectChunkIds(activeProjectId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  
  // Replace local loading state with Mutation Hooks
  const { mutate: importText, isPending: isImportingText } = useImportTextMutation();
  const { mutate: importDoc, isPending: isImportingDoc } = useImportDocumentMutation();
  
  const isImporting = isImportingText || isImportingDoc;

  const handleQuickAdd = () => {
      if (!inputValue.trim()) return;
      const textToProcess = inputValue;
      setInputValue('');
      
      importText(textToProcess, {
          onSuccess: () => {
              inputAreaRef.current?.focus();
          }
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          importDoc(e.target.files[0], {
              onSuccess: () => {
                  if (fileInputRef.current) fileInputRef.current.value = '';
              }
          });
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleQuickAdd();
      }
  };

  useEffect(() => {
    if (activeChunkId !== null && virtuosoRef.current && chunkIds) {
        const index = chunkIds.indexOf(activeChunkId);
        if (index !== -1) {
            setTimeout(() => {
                virtuosoRef.current?.scrollIntoView({ 
                    index, 
                    behavior: 'smooth', 
                    align: 'center'
                });
            }, 50);
        }
    }
  }, [activeChunkId, chunkIds]);

  if (isChunksLoading) {
      return (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs font-medium">Loading Project...</p>
          </div>
      );
  }

  return (
    <div className="h-full w-full flex flex-col">
        {/* Input Cell */}
        <div className="max-w-3xl w-full mx-auto px-6 py-6 border-b border-border bg-background/50 backdrop-blur-sm z-10 sticky top-0">
            <div className="relative group shadow-sm hover:shadow-md transition-shadow rounded-xl">
                <textarea 
                    ref={inputAreaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type or paste text here... Press Cmd+Enter to turn into audio cells instantly."
                    className="w-full min-h-[80px] p-4 pb-12 rounded-xl border border-border bg-card text-lg font-serif resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                    disabled={isImporting}
                />
                
                <div className="absolute bottom-3 left-3 flex gap-2">
                    <input 
                        type="file" 
                        accept=".txt,.pdf" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors bg-secondary/50 rounded hover:bg-secondary disabled:opacity-50"
                    >
                        <Upload className="w-3 h-3" /> Import File
                    </button>
                </div>

                <button 
                    onClick={handleQuickAdd}
                    disabled={!inputValue.trim() || isImporting}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:scale-105 active:scale-95 disabled:opacity-0 transition-all shadow-md"
                    title="Create Cells (Cmd+Enter)"
                >
                    {isImporting ? (
                        <Plus className="w-4 h-4 animate-spin" />
                    ) : (
                        <div className="flex items-center gap-1">
                            <Send className="w-3.5 h-3.5" />
                            <span>GENERATE</span>
                        </div>
                    )}
                </button>
            </div>
        </div>

        <AppErrorBoundary name="TimelineList">
        <Virtuoso
            ref={virtuosoRef}
            data={chunkIds || []}
            components={{
                Header: () => <div className="pt-4">{header}</div>,
                Footer: () => <div className="h-48" />
            }}
            itemContent={(index, chunkId) => (
                <div className="max-w-3xl mx-auto w-full px-6">
                    <ChunkItem 
                        key={chunkId} 
                        chunkId={chunkId}
                        isLast={index === (chunkIds?.length || 0) - 1} 
                        isActive={activeChunkId === chunkId}
                    />
                </div>
            )}
            style={{ height: '100%' }}
        />
        </AppErrorBoundary>
    </div>
  );
};