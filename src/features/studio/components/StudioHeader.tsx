import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useProject } from '../../../shared/hooks/useQueries';
import { ModelStatus } from '../../../shared/types/tts';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { projectRoute } from '../../../app/router';
import { ProjectSearch } from './ProjectSearch';
import { Activity, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';

/**
 * [EPIC 2] Simplified Header.
 * Moves tools to Right Sidebar (Inspector) for extreme focus.
 */
export const StudioHeader: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams({ from: projectRoute.id });
    const { activeProjectId } = useProjectStore();
    const { modelStatus, progressPercent } = useTTSStore();
    const { data: project } = useProject(activeProjectId || parseInt(projectId));

    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project?.name) setTitle(project.name);
    }, [project?.name]);

    const handleTitleBlur = async () => {
        const pId = activeProjectId || parseInt(projectId);
        if (!pId || !title.trim() || title === project?.name) return;
        
        setIsSaving(true);
        try {
            await ProjectRepository.update(pId, { name: title, updatedAt: new Date() });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <header className="glass-header h-14 flex items-center px-4 justify-between gap-4 border-b border-border/50">
            {/* LEFT: Navigation & Context */}
            <div className="flex items-center gap-3 min-w-0">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate({ to: '/' })}
                    className="hover:bg-secondary rounded-full w-8 h-8 shrink-0"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        className="bg-transparent border-none font-bold text-sm p-0 focus:ring-0 w-auto min-w-[50px] truncate hover:bg-secondary/40 rounded-md px-2 py-1 transition-colors"
                        placeholder="Untitled Project"
                    />
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin opacity-40 shrink-0" />}
                </div>
            </div>

            {/* CENTER: Search */}
            <div className="flex-1 flex justify-center max-w-md">
                <ProjectSearch />
            </div>

            {/* RIGHT: Status Only */}
            <div className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${
                    modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-500/5 border-green-500/20' :
                    modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-500/5 border-amber-500/20 animate-pulse' :
                    'text-muted-foreground bg-secondary/50 border-border'
                }`}>
                    <Activity className="w-3 h-3" />
                    {modelStatus === ModelStatus.LOADING ? `${progressPercent}%` : modelStatus}
                </div>
            </div>
        </header>
    );
};