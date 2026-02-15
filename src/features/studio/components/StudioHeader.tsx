import React from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useGlobalJobStatus } from '../../../shared/hooks/useQueries';
import { AVAILABLE_MODELS, ModelStatus } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { ProjectRepository } from '../../library/api/ProjectRepository';
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
    Trash
} from 'lucide-react';
import { db } from '../../../shared/db';
import { storage } from '../../../shared/services/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';

export const StudioHeader: React.FC = () => {
    const { activeProjectId, isExporting } = useProjectStore();
    const { modelStatus, availableVoices, progressPhase, progressPercent } = useTTSStore();
    const { activeModelId, setActiveModelId, storageMode } = useSystemStore();
    const { isWorking, pendingCount } = useGlobalJobStatus();

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
            <div className="flex items-center gap-3">
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

                {/* EPIC 1: Replaced raw select with Radix Select */}
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

                    <Select disabled={modelStatus !== ModelStatus.READY}>
                        <SelectTrigger className="w-[140px] bg-secondary/20 border-none hover:bg-secondary/40 h-8">
                            <User className="w-3 h-3 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Voice" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableVoices.map(v => (
                                <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
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

                    {isWorking && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-primary animate-pulse bg-primary/5 px-2 py-1 rounded-md border border-primary/20">
                            <Layers className="w-3 h-3" />
                            <span>SYNCING {pendingCount}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold tracking-widest mr-4 bg-secondary/30 px-2 py-1 rounded">
                    <HardDrive className="w-3 h-3" />
                    {storageMode}
                </div>

                <Button variant="ghost" size="icon" onClick={() => logger.exportLogs()} title="Diagnostic Bundle">
                    <Terminal className="w-4 h-4" />
                </Button>

                {activeProjectId && (
                    <>
                        {/* EPIC 1: Replaced window.confirm with Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Purge Cache">
                                    <Loader2 className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Purge Project Cache?</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 text-sm text-muted-foreground">
                                    This will delete all generated audio files for this project. They will be re-synthesized automatically.
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => {}}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleClearCache}>Purge Everything</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

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
                    </>
                )}
            </div>
        </header>
    );
};