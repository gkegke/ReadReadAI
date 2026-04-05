import React from 'react';
import { Link, Outlet, useParams, useNavigate } from '@tanstack/react-router';
import { useUIStore } from '../../store/useUIStore';
import { useSystemStore } from '../../store/useSystemStore';
import { useProjects } from '../../hooks/useQueries';
import { ProjectRepository } from '../../../features/library/api/ProjectRepository';
import { GlobalHeader } from '../GlobalHeader';
import { ProjectInspector } from '../../../features/studio/components/ProjectInspector';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { HardDrive, ShieldCheck, FileText, Plus, Trash2, Zap, HelpCircle } from 'lucide-react';
import { DemoService } from '../../services/DemoService';
import { queryClient } from '../../lib/queryClient';
import { StorageQuotaService } from '../../services/storage/StorageQuotaService';

/**
 * MainLayout
 */
export const MainLayout: React.FC = () => {
    const { projectId } = useParams({ strict: false });
    const { isSidebarOpen } = useUIStore();
    const { storageMetrics } = useSystemStore();
    const { data: projects = [], isLoading } = useProjects();
    const navigate = useNavigate();

    // Derived state: only show inspector if we are in a project context
    const hasProjectContext = !!projectId;

    const handleCreateNew = async () => {
        const id = await ProjectRepository.createProject(`Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        navigate({ to: '/project/$projectId', params: { projectId: String(id) } });
    };

    const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Permanently delete "${name}"?`)) {
            await ProjectRepository.deleteProject(id);
            if (projectId && parseInt(projectId) === id) navigate({ to: '/' });
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
            <GlobalHeader />

            <div className="flex-1 flex min-h-0 relative overflow-hidden">
                {/* LEFT: Library Sidebar */}
                <aside className={cn(
                    "z-30 h-full flex flex-col bg-secondary/10 border-r transition-all duration-300 ease-in-out overflow-hidden shrink-0",
                    isSidebarOpen ? "w-64" : "w-0 border-none",
                )}>
                    <div className="flex flex-col h-full w-64">
                        <div className="p-4 h-12 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Library</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNew}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
                            {isLoading ? (
                                <div className="space-y-2 p-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary/50 rounded-xl animate-pulse" />)}
                                </div>
                            ) : projects.map(p => (
                                <Link
                                    key={p.id}
                                    to="/project/$projectId"
                                    params={{ projectId: String(p.id) }}
                                    className={cn(
                                        "group flex items-center justify-between p-2.5 rounded-xl transition-all border",
                                        projectId && parseInt(projectId) === p.id
                                            ? "bg-primary/10 border-primary/20 text-primary shadow-sm"
                                            : "hover:bg-secondary/50 border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        <span className="text-xs font-bold truncate tracking-tight">{p.name}</span>
                                    </div>
                                    <button onClick={(e) => handleDelete(e, p.id!, p.name)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </Link>
                            ))}
                                <Button
        variant="secondary"
        size="sm"
        className="w-full text-[10px] font-black tracking-widest uppercase h-8 mt-4 border border-primary/5 hover:border-primary/20"
        onClick={async () => {
            const id = await DemoService.checkAndCreateDemoProject(true);
            if (id) {
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                // Use the router to perform the transition
                navigate({ to: '/project/$projectId', params: { projectId: String(id) } });
            }
        }}
    >
        <HelpCircle className="w-3.5 h-3.5 mr-2 text-primary" />
        Initialize Help
    </Button>
                        </div>
<div className="p-4 border-t bg-secondary/5 space-y-3">
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <HardDrive className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-black uppercase text-muted-foreground">Local Disk</span>
        </div>
        <span className="text-[9px] font-mono font-bold">{storageMetrics.usageMb}MB</span>
    </div>
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
        <div className={cn("h-full transition-all duration-1000", storageMetrics.percent > 80 ? "bg-destructive" : "bg-primary")}
                style={{ width: `${storageMetrics.percent}%` }} />
    </div>

    <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/20"
        onClick={async () => {
            if (confirm("Clear ALL audio files across all projects? They will be regenerated on demand.")) {
                await StorageQuotaService.purgeAllAudioCache();
            }
        }}
    >
        <Zap className="w-2.5 h-2.5 mr-2" />
        Flush Local Cache
    </Button>
</div>
                    </div>
                </aside>

                {/* CENTER: Canvas */}
                <main className="flex-1 min-w-0 relative bg-background overflow-hidden">
                    <AppErrorBoundary name="StudioWorkspace">
                        <Outlet />
                    </AppErrorBoundary>
                </main>

                {/* RIGHT: Inspector (Conditionally mounted based on project context) */}
                {hasProjectContext && (
                    <AppErrorBoundary name="ProjectInspector">
                        <ProjectInspector />
                    </AppErrorBoundary>
                )}
            </div>
        </div>
    );
};
