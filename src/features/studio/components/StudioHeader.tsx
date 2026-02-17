import React from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useGlobalJobStatus, useProject, useChapter } from '../../../shared/hooks/useQueries';
import { AVAILABLE_MODELS, ModelStatus } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { SettingsMenu } from './SettingsMenu'; // [IMPORT: EPIC 3]
import { logger } from '../../../shared/services/Logger';
import { 
    Loader2, 
    Download, 
    Cpu, 
    User, 
    Activity, 
    HardDrive, 
    Layers, 
    Terminal, 
    Search,
    ChevronRight,
    Layout
} from 'lucide-react';
import { db } from '../../../shared/db';
import { storage } from '../../../shared/services/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';

export const StudioHeader: React.FC = () => {
    const { activeProjectId, activeChapterId, isExporting, setActiveChapter } = useProjectStore();
    const { modelStatus, availableVoices, progressPhase, progressPercent } = useTTSStore();
    const { activeModelId, setActiveModelId, storageMode } = useSystemStore();
    const { isWorking, pendingCount } = useGlobalJobStatus();

    const { data: project } = useProject(activeProjectId);
    const { data: chapter } = useChapter(activeChapterId);

    const handleModelChange = (val: string) => {
        setActiveModelId(val);
        ttsService.loadModel(val);
    };

    const handleClearCache = async () => {
        logger.warn('UI', 'User initiated cache purge');
        await db.audioCache.clear();
        await storage.deleteDirectory('audio');
        await db.chunks.where('status').equals('generated').modify({ status: 'pending' });
        window.location.reload();
    };

    const triggerSearch = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    };

    return (
        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mr-4">
                    <Layout className="w-3.5 h-3.5" />
                    <button 
                        onClick={() => setActiveChapter(null)}
                        className="hover:text-primary transition-colors"
                    >
                        {project?.name || 'Studio'}
                    </button>
                    <ChevronRight className="w-3 h-3 opacity-30" />
                    <span className="text-foreground">{chapter?.name || 'All Content'}</span>
                </div>

                <button 
                    onClick={triggerSearch}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 border border-border rounded-lg hover:bg-secondary transition-all group"
                >
                    <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                    <kbd className="hidden md:inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
                        ⌘K
                    </kbd>
                </button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <div className="flex items-center gap-1">
                    <Select value={activeModelId} onValueChange={handleModelChange}>
                        <SelectTrigger className="w-[160px] bg-secondary/20 border-none hover:bg-secondary/40 h-8">
                            <Cpu className="w-3 h-3 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                            {AVAILABLE_MODELS.map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3 ml-2">
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase px-2 py-1 rounded-md border ${
                        modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-500/5 border-green-500/20' :
                        modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-500/5 border-amber-500/20 animate-pulse' :
                        'text-muted-foreground bg-secondary/50 border-border'
                    }`}>
                        <Activity className="w-3 h-3" />
                        {modelStatus === ModelStatus.LOADING ? `${progressPhase} ${progressPercent}%` : modelStatus}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* [EPIC 3] Settings Menu Addition */}
                <SettingsMenu />

                <Button variant="ghost" size="icon" onClick={() => logger.exportLogs()} title="Diagnostic Bundle">
                    <Terminal className="w-4 h-4" />
                </Button>

                {activeProjectId && (
                    <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => ProjectRepository.exportProjectAudio(activeProjectId)}
                        disabled={isExporting}
                        className="font-black tracking-widest text-[10px]"
                    >
                        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
                        EXPORT ZIP
                    </Button>
                )}
            </div>
        </header>
    );
};