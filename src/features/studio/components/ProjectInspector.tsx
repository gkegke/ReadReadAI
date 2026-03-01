import React, { useMemo } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { ProjectProgressMap } from '../../library/components/ProjectProgressMap';
import { SettingsMenu } from './SettingsMenu';
import { VoiceSelector } from './VoiceSelector';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { AVAILABLE_MODELS } from '../../../shared/types/tts';
import { ttsService } from '../../tts/services/TTSService';
import { 
    Download, 
    Cpu, 
    AlignLeft,
    Layers,
    Loader2,
    CheckSquare,
    Square
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { Button } from '../../../shared/components/ui/button';

export const ProjectInspector: React.FC = () => {
    const { activeProjectId, setScrollToChunkId, isExporting, isSelectionMode, setSelectionMode } = useProjectStore();
    const { data: chunks } = useProjectChunks(activeProjectId);
    const { activeModelId, setActiveModelId } = useSystemStore();

    const headings = useMemo(() => {
        return chunks.filter(c => c.role === 'heading');
    }, [chunks]);

    if (!activeProjectId) return null;

    const handleModelChange = (val: string) => {
        setActiveModelId(val);
        ttsService.loadModel(val);
    };

    return (
        <aside className="w-64 border-l border-border bg-background/50 flex flex-col h-full overflow-hidden shrink-0">
            {/* CONFIGURATION SECTION */}
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
                            variant={isSelectionMode ? "primary" : "outline"} 
                            size="sm" 
                            onClick={() => setSelectionMode(!isSelectionMode)}
                            className="w-full font-black tracking-widest text-[9px] h-8 rounded-md"
                        >
                            {isSelectionMode ? <CheckSquare className="w-3 h-3 mr-1.5" /> : <Square className="w-3 h-3 mr-1.5" />}
                            {isSelectionMode ? "DONE" : "BULK EDIT"}
                        </Button>

                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => ProjectRepository.exportProjectAudio(activeProjectId)}
                            disabled={isExporting}
                            className="w-full font-black tracking-widest text-[9px] h-8 rounded-md"
                        >
                            {isExporting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Download className="w-3 h-3 mr-1.5" />}
                            EXPORT
                        </Button>
                    </div>
                </div>
            </div>

            {/* PROGRESS MAP */}
            <div className="px-2 pt-2 pb-4 border-b border-border/30">
                <ProjectProgressMap projectId={activeProjectId} />
            </div>

            {/* EXTRACTED OUTLINE */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex items-center gap-2 px-2 py-2 mb-1">
                    <AlignLeft className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Document Outline</span>
                </div>

                <div className="space-y-0.5">
                    {headings.length === 0 ? (
                        <div className="text-center py-6 opacity-40">
                            <span className="text-[10px] font-bold uppercase tracking-widest block">No Headings Found</span>
                            <span className="text-[9px] mt-1 block">Add a heading to navigate</span>
                        </div>
                    ) : (
                        headings.map((heading) => (
                            <button
                                key={heading.id}
                                onClick={() => setScrollToChunkId(heading.id!)}
                                className="w-full flex flex-col items-start px-3 py-2 rounded-lg text-xs text-left transition-all hover:bg-secondary hover:text-foreground group text-muted-foreground"
                            >
                                <span className="font-bold truncate w-full group-hover:text-primary transition-colors">
                                    {heading.textContent}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </aside>
    );
};