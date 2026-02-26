import React, { useEffect, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChunkItem } from './ChunkItem';
import { InsertionPoint } from './InsertionPoint';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries'; 
import { ChunkRepository } from '../api/ChunkRepository';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { useImportTextMutation } from '../../../shared/hooks/useMutations';
import { Loader2, FileText, FileUp, PlusSquare } from 'lucide-react';
import { AppErrorBoundary } from '../../../shared/components/AppErrorBoundary';
import { Button } from '../../../shared/components/ui/button';

/**
 * Studio Timeline (Epic 2 & 3 Version)
 * Stripped of variable-height collision DnD kits in favor of deterministic controls.
 */
export const Timeline: React.FC = () => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, activeChapterId } = useProjectStore();
  const { data: chunks, isLoading } = useProjectChunks(activeProjectId, activeChapterId);
  const { mutate: importText } = useImportTextMutation();
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (activeChunkId && virtuosoRef.current && chunks) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  // [EPIC 2] Deterministic Reordering
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...chunks];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    await ChunkRepository.reorder(activeProjectId!, newOrder.map(c => c.id!));
  };

  const handleMoveDown = async (index: number) => {
    if (index === chunks.length - 1) return;
    const newOrder = [...chunks];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    await ChunkRepository.reorder(activeProjectId!, newOrder.map(c => c.id!));
  };

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-30">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Loading Studio Canvas</span>
      </div>
  );

  // [EPIC 3] Explicit CTA Empty State
  if (!isLoading && chunks.length === 0) return (
      <div className="h-full flex flex-col items-center justify-center opacity-80 select-none text-center p-8 animate-in fade-in duration-700">
          <FileText className="w-12 h-12 mb-6 text-primary/50" />
          <h2 className="text-xl font-black uppercase tracking-widest mb-3">Project is Empty</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
              Start by importing a document, or create an empty block to type in manually.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button onClick={() => importText("New Chapter Content...")} className="w-56"><PlusSquare className="w-4 h-4 mr-2"/> Create First Block</Button>
              <label className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2 w-56">
                  <input type="file" className="hidden" accept=".pdf,.txt,.html" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeProjectId) return;
                      await ProjectRepository.importDocument(file, activeProjectId);
                      e.target.value = '';
                  }} />
                  <FileUp className="w-4 h-4 mr-2" /> Import PDF / TXT
              </label>
          </div>
          <div className="mt-12 max-w-xl w-full">
            <InsertionPoint 
                projectId={activeProjectId!} 
                chapterId={activeChapterId} 
                afterOrderIndex={0} 
            />
          </div>
      </div>
  );

  return (
    <div className="h-full w-full bg-background/30 selection:bg-primary/10">
        <AppErrorBoundary name="TimelineList">
            <Virtuoso
                ref={virtuosoRef}
                data={chunks}
                itemContent={(index, chunk) => (
                    <div className="max-w-4xl mx-auto w-full px-8 relative">
                        <InsertionPoint 
                            projectId={activeProjectId!} 
                            chapterId={activeChapterId} 
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
                        {/* Final Footer insertion point */}
                        {index === chunks.length - 1 && (
                             <InsertionPoint 
                                projectId={activeProjectId!} 
                                chapterId={activeChapterId} 
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
};