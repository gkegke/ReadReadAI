import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProject, useChapter } from '../../../shared/hooks/useQueries';
import { AVAILABLE_MODELS, ModelStatus } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { SettingsMenu } from './SettingsMenu';
import { logger } from '../../../shared/services/Logger';
import { projectRoute } from '../../../app/router';
import { 
    Loader2, 
    Download, 
    Cpu, 
    Activity, 
    ChevronLeft,
    Terminal,
    Hash
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { Button } from '../../../shared/components/ui/button';

/**
 * StudioHeader (Epic 2 Refactor)
 * Focuses on project context and metadata editing.
 */
export const StudioHeader: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams({ from: projectRoute.id });
    
    const { activeProjectId, activeChapterId, isExporting } = useProjectStore();
    const { modelStatus, progressPhase, progressPercent } = useTTSStore();
    const { activeModelId, setActiveModelId } = useSystemStore();

    const { data: project } = useProject(activeProjectId || parseInt(projectId));
    const { data: chapter } = useChapter(activeChapterId);

    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project?.name) setTitle(project.name);
    }, [project?.name]);

    // [STORY 4] Persistence of project name on blur
    const handleTitleBlur = async () => {
        const pId = activeProjectId || parseInt(projectId);
        if (!pId || !title.trim() || title === project?.name) return;
        
        setIsSaving(true);
        try {
            await ProjectRepository.update(pId, { name: title, updatedAt: new Date() });
            logger.info('Studio', `Project renamed to: ${title}`);
        } catch (err) {
            logger.error('Studio', 'Failed to rename project', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleModelChange = (val: string) => {
        setActiveModelId(val);
        ttsService.loadModel(val);
    };

    return (
        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate({ to: '/' })}
                    className="hover:bg-secondary rounded-full w-8 h-8"
                    title="Back to Library"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="h-6 w-[1px] bg-border mx-1" />

                <div className="flex items-center gap-2 overflow-hidden">
                    {/* [STORY 4] Notion-style editable title */}
                    <div className="relative group flex items-center">
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            className="bg-transparent border-none font-black text-sm p-0 focus:ring-0 w-auto min-w-[50px] max-w-[200px] truncate hover:bg-secondary/50 rounded px-1 transition-colors"
                            placeholder="Untitled Project"
                        />
                        {isSaving && <Loader2 className="w-3 h-3 animate-spin ml-2 opacity-40" />}
                    </div>

                    {/* [STORY 3] Breadcrumb breadcrumb */}
                    {chapter && (
                        <>
                            <span className="text-muted-foreground/30 font-light">/</span>
                            <span className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-tighter bg-primary/5 px-2 py-0.5 rounded border border-primary/10 animate-in fade-in slide-in-from-left-2">
                                <Hash className="w-3 h-3 opacity-50" />
                                {chapter.name}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1 bg-secondary/30 rounded-lg px-2 h-8 border border-border/50">
                    <Cpu className="w-3 h-3 text-muted-foreground ml-1" />
                    <Select value={activeModelId} onValueChange={handleModelChange}>
                        <SelectTrigger className="w-[140px] border-none bg-transparent h-7 text-[11px] font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {AVAILABLE_MODELS.map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className={`hidden lg:flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                    modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-500/5 border-green-500/20' :
                    modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-500/5 border-amber-500/20 animate-pulse' :
                    'text-muted-foreground bg-secondary/50 border-border'
                }`}>
                    <Activity className="w-3 h-3" />
                    {modelStatus === ModelStatus.LOADING ? `${progressPhase} ${progressPercent}%` : modelStatus}
                </div>

                <div className="h-6 w-[1px] bg-border mx-1" />

                <SettingsMenu />
                
                <Button variant="ghost" size="icon" onClick={() => logger.exportLogs()}>
                    <Terminal className="w-4 h-4" />
                </Button>

                {projectId && (
                    <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => ProjectRepository.exportProjectAudio(parseInt(projectId))}
                        disabled={isExporting}
                        className="font-black tracking-widest text-[10px] h-8"
                    >
                        {isExporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Download className="w-3 h-3 mr-2" />}
                        EXPORT
                    </Button>
                )}
            </div>
        </header>
    );
};