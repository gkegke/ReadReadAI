import React, { useState } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChapters } from '../../../shared/hooks/useQueries';
import { ChapterRepository } from '../../library/api/ChapterRepository';
import { ProjectProgressMap } from '../../library/components/ProjectProgressMap';
import { 
    Hash, 
    Plus, 
    Trash2, 
    ChevronRight, 
    LayoutList,
} from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

/**
 * ChapterOutline (Epic 4: Standardization)
 * Unified UI taxonomy pointing exclusively to "Chapters".
 */
export const ChapterOutline: React.FC = () => {
    const { activeProjectId, activeChapterId, setActiveChapter } = useProjectStore();
    const { data: chapters } = useProjectChapters(activeProjectId);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

    if (!activeProjectId) return null;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        await ChapterRepository.createChapter(activeProjectId, newName);
        setNewName('');
        setIsCreating(false);
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete this chapter and all its contents?')) {
            await ChapterRepository.deleteChapter(id);
            if (activeChapterId === id) setActiveChapter(null);
        }
    };

    return (
        <aside className="w-64 border-l border-border bg-background/50 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutList className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Chapters</span>
                </div>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="p-1 hover:bg-secondary rounded-md transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <section className="mb-6">
                    <ProjectProgressMap projectId={activeProjectId} chapterId={null} />
                </section>

                <div className="space-y-1">
                    <button
                        onClick={() => setActiveChapter(null)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all",
                            activeChapterId === null 
                                ? "bg-primary/5 text-primary font-bold shadow-sm" 
                                : "text-muted-foreground hover:bg-secondary"
                        )}
                    >
                        <ChevronRight className={cn("w-3 h-3 transition-transform", activeChapterId === null ? "rotate-90" : "")} />
                        Full Timeline
                    </button>

                    {isCreating && (
                        <form onSubmit={handleCreate} className="px-2 py-1">
                            <input
                                autoFocus
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Chapter name..."
                                className="w-full bg-secondary/50 border border-primary/30 rounded-md px-2 py-1.5 text-xs outline-none"
                                onBlur={() => !newName && setIsCreating(false)}
                            />
                        </form>
                    )}

                    {chapters.map((chapter) => {
                        const isActive = activeChapterId === chapter.id;
                        return (
                            <div key={chapter.id} className="group relative">
                                <button
                                    onClick={() => setActiveChapter(chapter.id!)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-left transition-all",
                                        isActive 
                                            ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20" 
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    )}
                                >
                                    <Hash className={cn("w-3.5 h-3.5 shrink-0", isActive ? "opacity-100" : "opacity-30")} />
                                    <span className="truncate pr-4">{chapter.name}</span>
                                </button>
                                
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(chapter.id!); }}
                                    className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground",
                                        isActive && "text-primary-foreground"
                                    )}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 bg-secondary/10 border-t border-border">
                <div className="text-[9px] font-mono text-muted-foreground uppercase text-center tracking-tighter">
                    {chapters.length} Chapters Defined
                </div>
            </div>
        </aside>
    );
};