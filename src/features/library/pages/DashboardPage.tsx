import React from 'react';
import { useProjects } from '../../../shared/hooks/useQueries';
import { ProjectRepository } from '../api/ProjectRepository';
import { Plus, FileText, Clock } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const DashboardPage: React.FC = () => {
    const { data: projects, isLoading } = useProjects();

    const handleCreate = async () => {
        const name = prompt("Project Name:");
        if (name) await ProjectRepository.createProject(name);
    };

    return (
        <div className="h-full overflow-y-auto p-8 bg-background">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">DASHBOARD</h1>
                        <p className="text-muted-foreground text-sm">Select a project to start generating audio.</p>
                    </div>
                    <button 
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-5 h-5" /> NEW PROJECT
                    </button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-secondary/20 animate-pulse rounded-xl" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {projects.map(project => (
                            <Link 
                                key={project.id} 
                                to="/project/$projectId" 
                                params={{ projectId: String(project.id) }}
                                className="group p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all hover:shadow-md"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-secondary rounded-lg text-primary">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(project.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{project.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">Local Storage (OPFS)</p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};