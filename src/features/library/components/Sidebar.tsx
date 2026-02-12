import React, { useState } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjects } from '../../../shared/hooks/useQueries';
import { ProjectRepository } from '../api/ProjectRepository';
import { Plus, Trash2, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

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
    <aside className="w-64 bg-secondary/20 h-screen border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <div className="w-2.5 h-2.5 bg-background rounded-sm" />
            </div>
            <h1 className="font-bold text-sm tracking-tight">READREAD STUDIO</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between px-2 py-2 mb-1">
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
                placeholder="Name project..."
                className="w-full px-3 py-1.5 text-xs rounded-md border border-primary/50 bg-background focus:ring-2 focus:ring-primary/10 outline-none"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onBlur={() => !newProjectName && setIsCreating(false)}
              />
            </form>
          )}

          {isLoading ? (
             <div className="px-3 py-4 flex justify-center">
                 <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
             </div>
          ) : projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-all",
                activeProjectId === project.id 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              onClick={() => setActiveProject(project.id!)}
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className={cn("w-3.5 h-3.5", activeProjectId === project.id ? "opacity-100" : "opacity-40")} />
                <span className="truncate">{project.name}</span>
              </div>
              {activeProjectId === project.id ? (
                  <ChevronRight className="w-3 h-3" />
              ) : (
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
          ))}
        </div>

        <div className="p-4 border-t border-border bg-secondary/10">
            <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Version</div>
                <div className="text-[10px] font-mono opacity-50">v0.8.0 (Feature Sliced)</div>
            </div>
        </div>
    </aside>
  );
};