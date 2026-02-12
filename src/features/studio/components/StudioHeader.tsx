import React from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useGlobalJobStatus } from '../../../shared/hooks/useQueries';
import { AVAILABLE_MODELS, ModelStatus } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { logger } from '../../../shared/services/Logger';
import { Loader2, Download, Cpu, User, Activity, HardDrive, Layers, Terminal } from 'lucide-react';
import { db } from '../../../shared/db';
import { storage } from '../../../shared/services/storage';

export const StudioHeader: React.FC = () => {
    const { activeProjectId, isExporting } = useProjectStore();
    const { modelStatus, availableVoices, progressPhase, progressPercent } = useTTSStore();
    const { activeModelId, setActiveModelId, storageMode } = useSystemStore();
    const { isWorking, pendingCount } = useGlobalJobStatus();

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setActiveModelId(newId);
        ttsService.loadModel(newId);
    };

    const handleClearCache = async () => {
        if (confirm("Clear all generated audio?")) {
            logger.warn('UI', 'User initiated cache purge');
            await db.audioCache.clear();
            await storage.deleteDirectory('audio');
            await db.chunks.where('status').equals('generated').modify({ status: 'pending' });
            window.location.reload();
        }
    };

    return (
        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border">
                    <div className="flex items-center gap-1.5 px-2 text-muted-foreground">
                        <Cpu className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Model</span>
                    </div>
                    <select 
                        value={activeModelId}
                        onChange={handleModelChange}
                        className="bg-transparent text-xs font-medium focus:outline-none pr-2"
                        disabled={modelStatus === ModelStatus.LOADING}
                    >
                        {AVAILABLE_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border">
                    <div className="flex items-center gap-1.5 px-2 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Voice</span>
                    </div>
                    <select 
                        className="bg-transparent text-xs font-medium focus:outline-none pr-2"
                        disabled={modelStatus !== ModelStatus.READY}
                    >
                        {availableVoices.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border ${
                        modelStatus === ModelStatus.READY ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                        modelStatus === ModelStatus.LOADING ? 'text-amber-600 bg-amber-50 border-amber-200 animate-pulse' :
                        'text-muted-foreground bg-secondary border-border'
                    }`}>
                        <Activity className="w-3 h-3" />
                        {modelStatus === ModelStatus.LOADING ? `${progressPhase} ${progressPercent}%` : modelStatus}
                    </div>

                    {isWorking && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
                            <Layers className="w-3 h-3" />
                            <span>PROCESSING {pendingCount}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <HardDrive className="w-3 h-3" />
                        <span className="uppercase font-bold tracking-widest">{storageMode}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={() => logger.exportLogs()}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Export Debug Logs"
                >
                    <Terminal className="w-4 h-4" />
                </button>
                {activeProjectId && (
                    <>
                        <button 
                            onClick={handleClearCache}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                            title="Clear Cache"
                        >
                            <Loader2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => ProjectRepository.exportProjectAudio(activeProjectId)}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            EXPORT ZIP
                        </button>
                    </>
                )}
            </div>
        </header>
    );
};