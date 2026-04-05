import React, { useState, useEffect } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useUIStore } from '../store/useUIStore';
import { useTTSStore } from '../../features/tts/store/useTTSStore';
import { useProject } from '../hooks/useQueries';
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { ProjectSearch } from '../../features/studio/components/ProjectSearch';
import { ModelStatus } from '../types/tts';
import {
    PanelLeft, PanelLeftClose, PanelRight, PanelRightClose,
    Disc, Edit3, Check, Loader2, Activity
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export const GlobalHeader: React.FC = () => {
    const { isSidebarOpen, toggleSidebar, isInspectorOpen, toggleInspector } = useUIStore();
    const { modelStatus, progressPercent } = useTTSStore();
    const { projectId } = useParams({ strict: false });
    const { data: project } = useProject(projectId ? parseInt(projectId) : null);

    const [title, setTitle] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project?.name) setTitle(project.name);
    }, [project?.name]);

    const handleSave = async () => {
        if (!project?.id || !title.trim() || title === project.name) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await ProjectRepository.update(project.id, { name: title, updatedAt: new Date() });
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <header className="h-14 flex items-center justify-between px-2 sm:px-4 border-b bg-background/95 backdrop-blur-xl z-50 shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                {/* [FIX: ISSUE 2] Removed 'hidden md:flex'. Sidebar toggle is now available on mobile. */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-8 w-8 shrink-0"
                    title="Toggle Library"
                >
                    {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                </Button>

                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">

                    <Link to="/" className="shrink-0 xs:block">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Disc className="w-5 h-5 text-background animate-spin [animation-duration:10s]" />
                        </div>
                    </Link>

                    {project && (
                        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xl">
                             {isEditing ? (
                                 <div className="flex items-center gap-2 w-full">
                                     <input
                                        autoFocus
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onBlur={handleSave}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                        className="bg-secondary/50 border-none text-[10px] sm:text-xs font-black uppercase tracking-widest w-full rounded px-2 py-1 outline-none ring-2 ring-primary/20"
                                    />
                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-green-600" />}
                                 </div>
                             ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 group min-w-0 text-left bg-transparent border-none p-0 cursor-pointer"
                                >
                                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest truncate">
                                        {project.name}
                                    </span>
                                    <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                             )}
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden lg:flex flex-1 justify-center max-w-md mx-4">
                {project && <ProjectSearch />}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                <div className={cn(
                    "flex items-center gap-1.5 text-[9px] font-black uppercase px-2 sm:px-3 py-1.5 rounded-full border transition-all",
                    modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-500/5 border-green-500/20' :
                    modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-500/5 border-amber-500/20' : 'text-muted-foreground bg-secondary/50'
                )}>
                    <Activity className={cn("w-3 h-3", modelStatus === ModelStatus.LOADING && "animate-pulse")} />
                    {/* Only show percent on larger screens to save mobile space */}
                    <span className="hidden sm:inline">{modelStatus === ModelStatus.LOADING ? `${progressPercent}%` : modelStatus}</span>
                </div>

                {project && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleInspector}
                        className={cn("h-8 w-8", isInspectorOpen ? "text-primary" : "text-muted-foreground")}
                        title="Toggle Inspector"
                    >
                        {isInspectorOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                    </Button>
                )}
            </div>
        </header>
    );
};
