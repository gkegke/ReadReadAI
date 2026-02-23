import React, { useState } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjects } from '../../../shared/hooks/useQueries';
import { ProjectRepository } from '../api/ProjectRepository';
import { Plus, Trash2, FileText, Loader2, Disc } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { cva } from 'class-variance-authority';

const sidebarItemVariants = cva(
    "group flex items-center justify-between px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-all mb-1 mx-2",
    {
        variants: {
            state: {
                active: "bg-primary text-primary-foreground shadow-lg shadow-primary/10 font-bold",
                inactive: "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            }
        },
        defaultVariants: { state: "inactive" }
    }
);

export const Sidebar: React.FC = () => {
  const { data: projects, isLoading } = useProjects();
  const { activeProjectId, setActiveProject } = useProjectStore();

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
    // [STORY: GLASSMORPHISM] Integrated glass-sidebar component class
    <aside className="w-64 glass-sidebar h-screen flex flex-col shrink-0 z-40">
        <div className="p-6 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                <Disc className="w-5 h-5 text-background animate-spin [animation-duration:10s]" />
            </div>
            <h1 className="font-black text-sm tracking-widest uppercase">READREAD</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          <section>
              <div className="flex items-center justify-between px-6 py-2 mb-2">
                  <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Filesystem</span>
                  <button onClick={() => setIsCreating(true)} className="p-1 hover:bg-secondary rounded-full transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                  </button>
              </div>
              
              {isCreating && (
                <form onSubmit={handleCreate} className="px-4 mb-4">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name..."
                    className="w-full px-4 py-2 text-xs rounded-xl border border-primary/20 bg-background/50 outline-none focus:ring-2 focus:ring-primary/10"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </form>
              )}

              {isLoading ? (
                 <div className="px-6 py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : projects.map((project) => {
                const isActive = activeProjectId === project.id;
                return (
                    <div
                        key={project.id}
                        className={sidebarItemVariants({ state: isActive ? 'active' : 'inactive' })}
                        onClick={() => setActiveProject(project.id!)}
                    >
                        <div className="flex items-center gap-3 truncate">
                            <FileText className={cn("w-4 h-4", isActive ? "opacity-100" : "opacity-30")} />
                            <span className="truncate tracking-tight">{project.name}</span>
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
                );
              })}
          </section>
        </div>

        <div className="p-6 bg-primary/[0.02] border-t border-border/50">
            <div className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] text-center">v0.9.0 CORE</div>
        </div>
    </aside>
  );
};