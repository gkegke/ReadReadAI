import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjects } from '../../../shared/hooks/useQueries';
import { FileText, Clock, LayoutGrid, Zap, UploadCloud, ShieldCheck, Disc, Trash2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { ProjectRepository } from '../api/ProjectRepository';
import { Button } from '../../../shared/components/ui/button';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { useProjectStore } from '../../../shared/store/useProjectStore';

export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { data: projects, isLoading } = useProjects();
    const [isDragging, setIsDragging] = useState(false);
    const [dragCounter, setDragCounter] = useState(0);

    const handleQuickStart = async () => {
        const id = await ProjectRepository.createProject(`Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        navigate({ to: '/project/$projectId', params: { projectId: String(id) } });
    };

    /**
     * [UX-PHASE-1] Frictionless Ingestion Drag and Drop Handlers
     */
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter(prev => prev + 1);
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter(prev => prev - 1);
        if (dragCounter - 1 === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter(0);
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        try {
            const projectName = file.name.replace(/\.[^/.]+$/, "") || "Imported Document";
            const id = await ProjectRepository.createProject(projectName);
            useProjectStore.getState().setActiveProject(id);
            await ProjectRepository.importDocument(file);
            navigate({ to: '/project/$projectId', params: { projectId: String(id) } });
        } catch (err) {
            console.error("Failed to import dropped file", err);
            alert("Failed to import document.");
        }
    };

    // [UX-PHASE-2] Global Deletion Flow
    const handleDeleteProject = async (e: React.MouseEvent, id: number, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
            await ProjectRepository.deleteProject(id);
        }
    };

    return (
        <div 
            className={`relative h-full overflow-y-auto p-8 bg-background selection:bg-primary/10 transition-colors ${isDragging ? 'bg-primary/5' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 m-4 rounded-3xl pointer-events-none">
                    <div className="text-center">
                        <UploadCloud className="w-20 h-20 text-primary mx-auto mb-4 animate-bounce" />
                        <h2 className="text-3xl font-black tracking-tight uppercase">Drop Document Here</h2>
                        <p className="text-muted-foreground mt-2 font-mono text-sm">PDF, TXT, HTML supported</p>
                    </div>
                </div>
            )}

            <div className={`max-w-6xl mx-auto ${isDragging ? 'pointer-events-none opacity-50' : ''}`}>
                <header className="flex items-end justify-between mb-12">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                            <Disc className="w-7 h-7 text-background animate-spin [animation-duration:10s]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <LayoutGrid className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">Library</span>
                            </div>
                            <h1 className="text-4xl font-black tracking-tight">STUDIO</h1>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="secondary"
                            onClick={handleQuickStart}
                            className="font-black tracking-widest text-xs h-12 px-6 rounded-2xl border-2 border-primary/10 hover:border-primary/30 transition-all"
                        >
                            <Zap className="w-4 h-4 mr-2 text-amber-500 fill-amber-500" />
                            QUICK START
                        </Button>
                        <CreateProjectDialog />
                    </div>
                </header>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-40 bg-secondary/20 animate-pulse rounded-2xl border border-border" />
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-primary/20 bg-secondary/10 rounded-3xl transition-all hover:border-primary/40 hover:bg-secondary/20">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <ShieldCheck className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight uppercase mb-2">100% Local. Zero Cloud.</h2>
                        <p className="text-sm text-muted-foreground font-bold tracking-widest uppercase opacity-60 mb-8 text-center max-w-md">
                            Absolute Privacy. Audio is synthesized directly on your device using WebAssembly.
                        </p>
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-muted-foreground/60 font-mono text-sm bg-background px-4 py-2 rounded-lg border border-border shadow-sm">
                                Drag & Drop a PDF or text file anywhere to begin
                            </div>
                            <div className="flex items-center gap-4 opacity-50 mt-2">
                                <span className="h-px w-12 bg-border"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest">or</span>
                                <span className="h-px w-12 bg-border"></span>
                            </div>
                            <Button variant="link" onClick={handleQuickStart} className="text-primary font-bold">
                                Create an empty project
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                                    <div className="flex flex-col items-end gap-2">
                                        <button
                                            onClick={(e) => handleDeleteProject(e, project.id!, project.name)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground rounded-md z-10 relative"
                                            title="Delete Project"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="text-right">
                                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Last Sync</div>
                                            <span className="text-[11px] font-mono opacity-60 flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3" />
                                                {new Date(project.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
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