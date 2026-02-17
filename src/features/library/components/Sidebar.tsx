import React, { useState } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjects, useProjectChapters } from '../../../shared/hooks/useQueries';
import { ProjectRepository } from '../api/ProjectRepository';
import { ProjectProgressMap } from './ProjectProgressMap'; // [IMPORT: EPIC 3]
import { Plus, Trash2, FileText, Loader2, Layers, Hash } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { cva } from 'class-variance-authority';

const sidebarItemVariants = cva(
    "group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all mb-0.5",
    {
        variants: {
            state: {
                active: "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold",
                inactive: "text-muted-foreground hover:bg-secondary hover:text-foreground",
            }
        },
        defaultVariants: { state: "inactive" }
    }
);

export const Sidebar: React.FC = () => {
  const { data: projects, isLoading } = useProjects();
  const { activeProjectId, setActiveProject, activeChapterId, setActiveChapter } = useProjectStore();
  const { data: chapters } = useProjectChapters(activeProjectId);

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    await ProjectRepository.createProject(newProjectName);
    setNewProjectName('');
    setIsCreating(false);
  };

  return (
    <aside className="w-64 bg-secondary/20 h-screen border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <div className="w-2.5 h-2.5 bg-background rounded-sm" />
            </div>
            <h1 className="font-bold text-sm tracking-tight italic">READREAD</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <section>
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Projects</span>
                  <button onClick={() => setIsCreating(true)} className="p-1 hover:bg-secondary rounded transition-colors">
                      <Plus className="w-3 h-3" />
                  </button>
              </div>
              
              {isCreating && (
                <form onSubmit={handleCreate} className="px-1 mb-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name..."
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-primary/50 bg-background outline-none"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </form>
              )}

              {isLoading ? (
                 <div className="px-3 py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : projects.map((project) => {
                const isActive = activeProjectId === project.id;
                return (
                    <div key={project.id} className="mb-1">
                        <div
                            className={sidebarItemVariants({ state: isActive ? 'active' : 'inactive' })}
                            onClick={() => setActiveProject(project.id!)}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <FileText className={cn("w-3.5 h-3.5", isActive ? "opacity-100" : "opacity-40")} />
                                <span className="truncate">{project.name}</span>
                            </div>
                            {!isActive && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(confirm('Delete project?')) ProjectRepository.deleteProject(project.id!);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {isActive && (
                            <div className="ml-4 pl-2 border-l border-primary/20 mt-2 space-y-1 animate-in slide-in-from-left-2 duration-200">
                                {/* [EPIC 3: STORY 7] Project Heatmap Integration */}
                                <ProjectProgressMap projectId={project.id!} chapterId={activeChapterId} />

                                <button 
                                    onClick={() => setActiveChapter(null)}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] uppercase tracking-wider transition-colors",
                                        activeChapterId === null ? "text-primary font-black bg-primary/5" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Layers className="w-3 h-3" /> All Content
                                </button>
                                {chapters.map(chapter => (
                                    <button 
                                        key={chapter.id}
                                        onClick={() => setActiveChapter(chapter.id!)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                                            activeChapterId === chapter.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Hash className="w-3 h-3 opacity-40" />
                                        <span className="truncate">{chapter.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
              })}
          </section>
        </div>

        <div className="p-4 border-t border-border bg-secondary/10">
            <div className="text-[10px] font-mono opacity-50 uppercase tracking-tighter text-center">Studio v0.9.0-EPIC3</div>
        </div>
    </aside>
  );
};