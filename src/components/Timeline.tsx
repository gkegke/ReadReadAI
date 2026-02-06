import React, { useEffect, useRef, useState } from 'react';
import { ChunkItem } from './ChunkItem';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore, useActiveProjectChunkIds } from '../store/useProjectStore';
import { ProjectActions } from '../services/ProjectActions';
import { Virtuoso, type VirtuosoHandle, type ListRange } from 'react-virtuoso';
import { Plus, Send, Upload } from 'lucide-react';
import { generationManager } from '../services/GenerationManager'; // Added

interface TimelineProps {
  header?: React.ReactNode; 
}

export const Timeline: React.FC<TimelineProps> = ({ header }) => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, isProcessing } = useProjectStore();
  
  // Optimized: Only subscribe to the list of IDs
  const chunkIds = useActiveProjectChunkIds(activeProjectId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');

  const handleQuickAdd = async () => {
      if (!inputValue.trim()) return;
      const textToProcess = inputValue;
      setInputValue('');
      await ProjectActions.importRawText(textToProcess);
      inputAreaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleQuickAdd();
      }
  };

  // Pass visibility info to GenerationManager
  const handleRangeChanged = (range: ListRange) => {
      generationManager.updateVisibleRange(range.startIndex, range.endIndex);
  };

  useEffect(() => {
    if (activeChunkId !== null && virtuosoRef.current && chunkIds) {
        const index = chunkIds.indexOf(activeChunkId);
        if (index !== -1) {
            // "Virtuoso, please ensure the playing chunk is visible"
            // We use a slight timeout to allow the layout to settle if it was a fresh load
            setTimeout(() => {
                virtuosoRef.current?.scrollIntoView({ 
                    index, 
                    behavior: 'smooth', 
                    align: 'center',
                    done: () => {} // Callback when scrolling finished
                });
            }, 50);
        }
    }
  }, [activeChunkId, chunkIds]);

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
                />
                
                <div className="absolute bottom-3 left-3 flex gap-2">
                    <input 
                        type="file" 
                        accept=".txt,.pdf" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && ProjectActions.importDocument(e.target.files[0])}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors bg-secondary/50 rounded hover:bg-secondary"
                    >
                        <Upload className="w-3 h-3" /> Import File
                    </button>
                </div>

                <button 
                    onClick={handleQuickAdd}
                    disabled={!inputValue.trim() || isProcessing}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:scale-105 active:scale-95 disabled:opacity-0 transition-all shadow-md"
                    title="Create Cells (Cmd+Enter)"
                >
                    {isProcessing ? (
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

        <Virtuoso
            ref={virtuosoRef}
            data={chunkIds || []}
            rangeChanged={handleRangeChanged}
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
    </div>
  );
};