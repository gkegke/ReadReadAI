import React, { useEffect, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChunkItem } from './ChunkItem';
import { InsertionPoint } from './InsertionPoint';
import { FloatingActionBar } from './FloatingActionBar'; 
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries'; 
import { ChunkRepository } from '../api/ChunkRepository';
import { Loader2 } from 'lucide-react';
import { AppErrorBoundary } from '../../../shared/components/AppErrorBoundary';

/**
 * Timeline Component
 * Using a named export to ensure compatibility with StudioPage imports.
 */
export function Timeline() {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, scrollToChunkId, setScrollToChunkId } = useProjectStore();
  const { data: chunks, isLoading } = useProjectChunks(activeProjectId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Auto-scroll logic for Active Playback
  useEffect(() => {
    if (activeChunkId && virtuosoRef.current && chunks) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  // Scroll logic for Inspector Headings
  useEffect(() => {
    if (scrollToChunkId && virtuosoRef.current && chunks.length > 0) {
        const index = chunks.findIndex(c => c.id === scrollToChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'start' });
        }
        setScrollToChunkId(null);
    }
  }, [scrollToChunkId, chunks, setScrollToChunkId]);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const current = chunks[index];
    const previous = chunks[index - 1];
    await ChunkRepository.swapChunks(current.id!, previous.id!);
  };

  const handleMoveDown = async (index: number) => {
    if (index === chunks.length - 1) return;
    const current = chunks[index];
    const next = chunks[index + 1];
    await ChunkRepository.swapChunks(current.id!, next.id!);
  };

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-30">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Loading Studio Canvas</span>
      </div>
  );

  if (!isLoading && chunks.length === 0) return (
      <div className="h-full w-full bg-background/30 flex flex-col items-center pt-24 animate-in fade-in duration-700">
          <div className="max-w-4xl w-full px-8">
              <InsertionPoint projectId={activeProjectId!} afterOrderIndex={-1} />
          </div>
      </div>
  );

  return (
    <div className="h-full w-full bg-background/30 selection:bg-primary/10 relative">
        <FloatingActionBar />
        <AppErrorBoundary name="TimelineList">
            <Virtuoso
                ref={virtuosoRef}
                data={chunks}
                itemContent={(index, chunk) => (
                    <div className="max-w-4xl mx-auto w-full px-8 relative">
                        <InsertionPoint 
                            projectId={activeProjectId!} 
                            afterOrderIndex={index - 1} 
                        />
                        <ChunkItem 
                            chunk={chunk}
                            isActive={activeChunkId === chunk.id}
                            index={index}
                            totalChunks={chunks.length}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                        />
                        {index === chunks.length - 1 && (
                             <InsertionPoint 
                                projectId={activeProjectId!} 
                                afterOrderIndex={index} 
                            />
                        )}
                    </div>
                )}
                components={{ Footer: () => <div className="h-96" /> }}
                style={{ height: '100%' }}
                className="scrollbar-hide"
            />
        </AppErrorBoundary>
    </div>
  );
}