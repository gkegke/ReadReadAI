import React, { useEffect, useRef, useState } from 'react';
import type { Chunk } from '../types/schema';
import { ChunkItem } from './ChunkItem';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore } from '../store/useProjectStore';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Plus, Send, Upload } from 'lucide-react';

interface TimelineProps {
  chunks: Chunk[];
  header?: React.ReactNode; 
}

export const Timeline: React.FC<TimelineProps> = ({ chunks, header }) => {
  const { activeChunkId } = useAudioStore();
  const { importRawText, isProcessing, importDocument } = useProjectStore();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputValue, setInputValue] = useState('');

  const handleQuickAdd = async () => {
      if (!inputValue.trim()) return;
      await importRawText(inputValue);
      setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleQuickAdd();
      }
  };

  useEffect(() => {
    if (activeChunkId !== null && virtuosoRef.current) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  return (
    <div className="h-full w-full flex flex-col">
        {/* Persistent Input Cell */}
        <div className="max-w-3xl w-full mx-auto px-6 py-6 border-b border-border bg-background/50">
            <div className="relative group">
                <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste or type text to generate audio cells... (Ctrl + Enter)"
                    className="w-full min-h-[100px] p-4 pb-12 rounded-xl border border-border bg-card text-lg font-serif resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
                <div className="absolute bottom-3 left-3 flex gap-2">
                    <input 
                        type="file" 
                        accept=".txt,.pdf" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && importDocument(e.target.files[0])}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5" /> Import File
                    </button>
                </div>
                <button 
                    onClick={handleQuickAdd}
                    disabled={!inputValue.trim() || isProcessing}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:scale-105 active:scale-95 disabled:opacity-0 transition-all shadow-md"
                >
                    {isProcessing ? <Plus className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    CREATE CELLS
                </button>
            </div>
        </div>

        <Virtuoso
            ref={virtuosoRef}
            data={chunks}
            components={{
                Header: () => <div className="pt-4">{header}</div>,
                Footer: () => <div className="h-48" />
            }}
            itemContent={(index, chunk) => (
                <div className="max-w-3xl mx-auto w-full px-6">
                    <ChunkItem 
                        key={chunk.id} 
                        chunk={chunk} 
                        isLast={index === chunks.length - 1} 
                        isActive={activeChunkId === chunk.id}
                    />
                </div>
            )}
            style={{ height: '100%' }}
        />
    </div>
  );
};