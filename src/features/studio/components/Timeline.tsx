import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChunkItem } from './ChunkItem';
import { InsertionPoint } from './InsertionPoint';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useUIStore } from '../../../shared/store/useUIStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { useImportTextMutation } from '../../../shared/hooks/useMutations';
import { deriveChapters, calculateChapterVisibility } from '../../../shared/lib/chapterUtils';
import { Loader2, Send, ChevronDown, ChevronRight, LayoutPanelLeft } from 'lucide-react';
import { AppErrorBoundary } from '../../../shared/components/AppErrorBoundary';
import { Button } from '../../../shared/components/ui/button';
import { cn } from '../../../shared/lib/utils';
import { logger } from '../../../shared/services/Logger';

export function Timeline() {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, scrollToChunkId, setScrollToChunkId } = useProjectStore();
  const { toggleChapterManual, userToggledChapters } = useUIStore();
  const { data: allChunks, isLoading } = useProjectChunks(activeProjectId);

  const [emptyStateText, setEmptyStateText] = useState("");
  const { mutate: importText, isPending: isImporting } = useImportTextMutation();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const chapters = useMemo(() => deriveChapters(allChunks || []), [allChunks]);

  /**
   * [ARCHITECTURE] Deterministic Flattening
   * Items are expanded based on user choice or cumulative threshold.
   */
  const visibleItems = useMemo(() => {
    if (!allChunks) return [];

    const flattened: any[] = [];
    chapters.forEach((ch, index) => {
      const isExpanded = calculateChapterVisibility(
          ch.id,
          index,
          chapters,
          userToggledChapters
      );

      flattened.push({
          type: 'header',
          ...ch,
          isHidden: !isExpanded
      });

      if (isExpanded) {
        ch.chunks.forEach(chunk => {
            flattened.push({ type: 'chunk', data: chunk });
        });
      }
    });
    return flattened;
  }, [chapters, userToggledChapters, allChunks]);

  useEffect(() => {
    if (scrollToChunkId && virtuosoRef.current) {
        const index = visibleItems.findIndex(item => item.type === 'chunk' && item.data.id === scrollToChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
            setScrollToChunkId(null);
        }
    }
  }, [scrollToChunkId, visibleItems, setScrollToChunkId]);

  if (!activeProjectId) return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-40">
          <LayoutPanelLeft className="w-16 h-16 mb-6 text-muted-foreground/50" />
          <h2 className="text-xs font-black uppercase tracking-widest">No Active Session</h2>
      </div>
  );

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-30">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Hydrating Studio Canvas</span>
      </div>
  );

  if (allChunks.length === 0) {
    return (
        <div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
            <div className="w-full bg-secondary/20 border border-border/50 rounded-[2rem] p-8 space-y-6 shadow-2xl">
                <textarea
                    value={emptyStateText}
                    onChange={(e) => setEmptyStateText(e.target.value)}
                    placeholder="Type or paste your manuscript here..."
                    className="w-full h-48 bg-transparent border-none outline-none resize-none text-xl font-serif"
                />
                <Button
                    disabled={!emptyStateText.trim() || isImporting}
                    onClick={() => { importText({ text: emptyStateText, projectId: activeProjectId! }); setEmptyStateText(""); }}
                >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    BEGIN PROCESSING
                </Button>
            </div>
        </div>
    );
  }

  const maxGlobalOrderIndex = Math.max(...allChunks.map(c => c.orderInProject));

  return (
    <div className="h-full w-full bg-background relative">
        <AppErrorBoundary name="TimelineVirtuoso">
            <Virtuoso
                ref={virtuosoRef}
                data={visibleItems}
                overscan={1000}
                itemContent={(_, item) => {
                    if (item.type === 'header') {
                        const isExpanded = !item.isHidden;

                        return (
                            <div className="max-w-4xl mx-auto w-full px-8 pt-12 pb-4">
                                <button
                                    onClick={() => toggleChapterManual(item.id, !isExpanded)}
                                    className="group flex items-center gap-3 bg-transparent border-none cursor-pointer"
                                >
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", !item.isHidden ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-primary/20")}>
                                        {item.isHidden ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">{item.title}</h2>
                                    {item.isHidden && (
                                        <span className="text-[9px] font-bold text-muted-foreground opacity-50 uppercase tracking-tight">
                                            ({item.chunks.length} blocks collapsed)
                                        </span>
                                    )}
                                </button>
                                {!item.isHidden && <div className="h-px w-full bg-gradient-to-r from-border to-transparent mt-4" />}
                            </div>
                        );
                    }

                    return (
                        <div className="max-w-4xl mx-auto w-full px-8 relative">
                            <InsertionPoint projectId={activeProjectId!} afterOrderIndex={item.data.orderInProject - 1} />
                            <ChunkItem
                                chunk={item.data}
                                isActive={activeChunkId === item.data.id}
                                index={item.data.orderInProject}
                            />
                        </div>
                    );
                }}
                components={{
                    Footer: () => (
                        <div className="max-w-4xl mx-auto w-full px-8 pt-4 pb-48">
                            <InsertionPoint projectId={activeProjectId!} afterOrderIndex={maxGlobalOrderIndex} />
                        </div>
                    )
                }}
                style={{ height: '100%' }}
            />
        </AppErrorBoundary>
    </div>
  );
}
