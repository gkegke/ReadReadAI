import React from 'react';
import { useProjects } from '../../../shared/hooks/useQueries';
import { FileText, Clock, LayoutGrid } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { CreateProjectDialog } from '../components/CreateProjectDialog';

export const DashboardPage: React.FC = () => {
    const { data: projects, isLoading } = useProjects();

    return (
        <div className="h-full overflow-y-auto p-8 bg-background selection:bg-primary/10">
            <div className="max-w-5xl mx-auto">
                <header className="flex items-end justify-between mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <LayoutGrid className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">Library</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight">STUDIO</h1>
                    </div>
                    {/* EPIC 1: Replaced window.prompt with Dialog */}
                    <CreateProjectDialog />
                </header>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-secondary/20 animate-pulse rounded-2xl border border-border" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <Link 
                                key={project.id} 
                                to="/project/$projectId" 
                                params={{ projectId: String(project.id) }}
                                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className="flex items-start justify-between mb-6">
                                    <div className="p-3 bg-secondary/50 rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Last Sync</div>
                                        <span className="text-[11px] font-mono opacity-60 flex items-center gap-1 justify-end">
                                            <Clock className="w-3 h-3" />
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <h3 className="font-bold text-xl truncate group-hover:text-primary transition-colors">{project.name}</h3>
                                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Local Storage</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};