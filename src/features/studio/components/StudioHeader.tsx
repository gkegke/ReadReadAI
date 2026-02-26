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
import { ProjectSearch } from './ProjectSearch'; // [NEW]
import { VoiceSelector } from './VoiceSelector'; // [NEW]
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

    const handleModelChange = (val: string) => {
        setActiveModelId(val);
        ttsService.loadModel(val);
    };

    return (
        <header className="glass-header h-14 flex items-center px-4 justify-between gap-4">
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

                    {chapter && (
                        <div className="hidden sm:flex items-center gap-1">
                            <span className="text-muted-foreground/30 font-light">/</span>
                            <span className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10 whitespace-nowrap">
                                <Hash className="w-3 h-3 opacity-50" />
                                {chapter.name}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER: Search & Navigation */}
            <div className="flex-1 flex justify-center max-w-md">
                <ProjectSearch />
            </div>

            {/* RIGHT: Tools & Status */}
            <div className="flex items-center gap-2 shrink-0">
                
                {/* Voice & Model Config (Now visible to general users) */}
                <div className="hidden lg:flex items-center gap-2 mr-2">
                    <VoiceSelector />
                    
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 h-8 border border-border/50">
                        <Cpu className="w-3 h-3 text-muted-foreground" />
                        <Select value={activeModelId} onValueChange={handleModelChange}>
                            <SelectTrigger className="w-[110px] border-none bg-transparent h-7 text-[10px] font-black uppercase tracking-tight focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {AVAILABLE_MODELS.map(m => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className={`hidden xl:flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${
                    modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-500/5 border-green-500/20' :
                    modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-500/5 border-amber-500/20 animate-pulse' :
                    'text-muted-foreground bg-secondary/50 border-border'
                }`}>
                    <Activity className="w-3 h-3" />
                    {modelStatus === ModelStatus.LOADING ? `${progressPercent}%` : modelStatus}
                </div>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {projectId && (
                    <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => ProjectRepository.exportProjectAudio(parseInt(projectId))}
                        disabled={isExporting}
                        className="font-black tracking-[0.2em] text-[10px] h-8 px-4 rounded-full"
                    >
                        {isExporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Download className="w-3 h-3 mr-2" />}
                        EXPORT
                    </Button>
                )}

                <SettingsMenu />
            </div>
        </header>
    );
};