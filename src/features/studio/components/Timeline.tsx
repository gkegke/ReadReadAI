import React, { useEffect, useRef } from 'react';
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    type DragEndEvent 
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChunkItem } from './ChunkItem';
import { InsertionPoint } from './InsertionPoint';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries'; 
import { ChunkRepository } from '../api/ChunkRepository';
import { Loader2 } from 'lucide-react';
import { AppErrorBoundary } from '../../../shared/components/AppErrorBoundary';

/**
 * Studio Timeline (Epic 3 Version)
 * Now a high-fidelity "Infinite Canvas" supporting reordering and 
 * mid-content synthesis via InsertionPoints.
 */
export const Timeline: React.FC = () => {
  const { activeChunkId } = useAudioStore();
  const { activeProjectId, activeChapterId } = useProjectStore();
  const { data: chunks, isLoading } = useProjectChunks(activeProjectId, activeChapterId);
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (activeChunkId && virtuosoRef.current && chunks) {
        const index = chunks.findIndex(c => c.id === activeChunkId);
        if (index !== -1) {
            virtuosoRef.current.scrollIntoView({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }, [activeChunkId, chunks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = chunks.findIndex(c => c.id === active.id);
        const newIndex = chunks.findIndex(c => c.id === over.id);
        
        const newOrder = arrayMove(chunks, oldIndex, newIndex);
        const ids = newOrder.map(c => c.id as number);
        
        // Optimistic UI handled by Dexie useLiveQuery, 
        // but we push the update to the Repo.
        await ChunkRepository.reorder(activeProjectId!, ids);
    }
  };

  if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center opacity-30">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Loading Studio Canvas</span>
      </div>
  );

  return (
    <div className="h-full w-full bg-background/30 selection:bg-primary/10">
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={chunks.map(c => c.id!)} strategy={verticalListSortingStrategy}>
                <AppErrorBoundary name="TimelineList">
                    <Virtuoso
                        ref={virtuosoRef}
                        data={chunks}
                        itemContent={(index, chunk) => (
                            <div className="max-w-4xl mx-auto w-full px-8">
                                <InsertionPoint 
                                    projectId={activeProjectId!} 
                                    chapterId={activeChapterId} 
                                    afterOrderIndex={index - 1} 
                                />
                                <ChunkItem 
                                    chunk={chunk}
                                    isActive={activeChunkId === chunk.id}
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
            </SortableContext>
        </DndContext>
    </div>
  );
};