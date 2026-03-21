import React, { useMemo } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectChunks, useDetailedJobStatus } from '../../../shared/hooks/useQueries';
import { ProjectProgressMap } from '../../library/components/ProjectProgressMap';
import { SettingsMenu } from './SettingsMenu';
import { VoiceSelector } from './VoiceSelector';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { AVAILABLE_MODELS } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { useQueueMissingChunksMutation, useClearProjectAudioMutation } from '../../../shared/hooks/useMutations';
import { useServices } from '../../../shared/context/ServiceContext';
import { cn } from '../../../shared/lib/utils';
import { 
    Download, 
    Cpu, 
    AlignLeft,
    Layers,
    Loader2,
    CheckSquare,
    Square,
    Zap,
    Trash2,
    PauseCircle,
    PlayCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { Button } from '../../../shared/components/ui/button';

export const ProjectInspector: React.FC = () => {
    const { activeProjectId, setScrollToChunkId, isExporting, isSelectionMode, setSelectionMode, isInspectorOpen, setInspectorOpen } = useProjectStore();
    const { data: chunks } = useProjectChunks(activeProjectId);
    const { activeModelId, setActiveModelId } = useSystemStore();
    
    const { mutate: queueMissing, isPending: isQueueing } = useQueueMissingChunksMutation();
    const { mutate: clearAudio, isPending: isClearing } = useClearProjectAudioMutation();
    const { queue } = useServices();
    
    const { active: activeJobs, pendingCount } = useDetailedJobStatus(activeProjectId);
    const queueState = queue.getStatus();

    const headings = useMemo(() => {
        return chunks.filter(c => c.role === 'heading');
    }, [chunks]);

    if (!activeProjectId) return null;

    const handleModelChange = (val: string) => {
        setActiveModelId(val);
        ttsService.loadModel(val);
    };

    const handleGenerateAll = () => {
        queueMissing({ projectId: activeProjectId }, {
            onSuccess: () => queue.poke()
        });
    };

    return (
        <>
            {/* [RESPONSIVE] Mobile Backdrop Overlay */}
            <div 
                className={cn(
                    "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300",
                    isInspectorOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setInspectorOpen(false)}
            />

            <aside className={cn(
                "fixed inset-y-0 right-0 z-50 flex flex-col bg-background/95 md:bg-background/50 backdrop-blur-xl border-border shadow-2xl transition-all duration-300 ease-in-out overflow-hidden",
                "md:relative md:z-0 md:shadow-none",
                isInspectorOpen 
                    ? "translate-x-0 w-72 md:w-64 border-l" 
                    : "translate-x-full md:translate-x-0 w-72 md:w-0 border-l-0"
            )}>
                {/* 
                  [UX] Fixed width wrapper ensures contents don't wrap/squish 
                  during the width transition on desktop layouts.
                */}
                <div className="w-72 md:w-64 flex flex-col h-full shrink-0">
                    <div className="p-4 border-b border-border/50 bg-secondary/10 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Inspector</span>
                            </div>
                            <SettingsMenu />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-1 bg-background rounded-md px-2 h-8 border border-border/50">
                                <Cpu className="w-3 h-3 text-muted-foreground" />
                                <Select value={activeModelId} onValueChange={handleModelChange}>
                                    <SelectTrigger className="w-full border-none bg-transparent h-7 text-[10px] font-black uppercase tracking-tight focus:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {AVAILABLE_MODELS.map(m => (
                                            <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <VoiceSelector />

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleGenerateAll}
                                    disabled={isQueueing}
                                    className="w-full font-black tracking-widest text-[9px] h-8 rounded-md border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                    {isQueueing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" fill="currentColor" />}
                                    GENERATE
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => queueState === 'paused' ? (queue as any).resume() : queue.stop()}
                                    className="w-full font-black tracking-widest text-[9px] h-8 rounded-md"
                                >
                                    {queueState === 'paused' ? <PlayCircle className="w-3.5 h-3.5 mr-1" /> : <PauseCircle className="w-3.5 h-3.5 mr-1" />}
                                    {queueState === 'paused' ? "RESUME" : "PAUSE"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* LIVE QUEUE STATUS */}
                    <div className="px-4 py-3 border-b border-border/30 bg-primary/[0.02]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Live Queue</span>
                            <span className={cn(
                                "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                queueState === 'paused' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                            )}>
                                {/* [FIX: TS2322] Cast StateValue to string for React compatibility */}
                                {String(queueState)}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {activeJobs.length > 0 ? (
                                activeJobs.map(job => (
                                    <div key={job.id} className="flex items-center gap-2 animate-pulse">
                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                        <span className="text-[10px] font-medium truncate italic text-foreground/70">
                                            "{job.text}"
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[10px] text-muted-foreground opacity-50 py-1">No active synthesis...</div>
                            )}
                            
                            {pendingCount > 0 && (
                                <div className="text-[9px] font-bold text-primary/60 uppercase tracking-tighter">
                                    + {pendingCount} chunks waiting
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-2 pt-2 pb-4 border-b border-border/30">
                        <ProjectProgressMap projectId={activeProjectId} />
                    </div>

                    {/* OUTLINE */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="flex items-center gap-2 px-2 py-2 mb-1">
                            <AlignLeft className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Outline</span>
                        </div>
                        <div className="space-y-0.5">
                            {headings.map((heading) => (
                                <button
                                    key={heading.id}
                                    onClick={() => {
                                        setScrollToChunkId(heading.id!);
                                        if (window.innerWidth < 768) setInspectorOpen(false);
                                    }}
                                    className="w-full flex flex-col items-start px-3 py-2 rounded-lg text-xs text-left transition-all hover:bg-secondary hover:text-foreground group text-muted-foreground"
                                >
                                    <span className="font-bold truncate w-full group-hover:text-primary">
                                        {heading.textContent}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-border/50">
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => {if(confirm("Clear audio?")) clearAudio(activeProjectId)}}
                            disabled={isClearing}
                            className="w-full font-black tracking-widest text-[9px] h-8 rounded-md bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            PURGE CACHE
                        </Button>
                    </div>
                </div>
            </aside>
        </>
    );
};