import React, { useMemo } from 'react';
import { useUIStore } from '../../../shared/store/useUIStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { VoiceSelector } from './VoiceSelector';
import { ExportDialog } from './ExportDialog';
import { deriveChapters, calculateChapterVisibility } from '../../../shared/lib/chapterUtils';
import { cn } from '../../../shared/lib/utils';
import { AVAILABLE_MODELS } from '../../../shared/types/tts';
import {
    Layers, AlignLeft, Gauge, ChevronDown, ChevronRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { useServices } from '../../../shared/context/ServiceContext';

export const ProjectInspector: React.FC = () => {
    const { isInspectorOpen, userToggledChapters, toggleChapterManual } = useUIStore();
    const { activeProjectId, setScrollToChunkId } = useProjectStore();
    const { activeChunkId, playbackRate, setPlaybackSpeed } = useAudioStore();
    const { activeModelId, setActiveModelId } = useSystemStore();
    const { tts } = useServices();

    const { data: chunks = [] } = useProjectChunks(activeProjectId);
    const chapters = useMemo(() => deriveChapters(chunks), [chunks]);

    const isLargeProject = chunks.length > 150;

    const handleModelChange = async (id: string) => {
        setActiveModelId(id);
        await tts.loadModel(id);
    };

    return (
        <aside className={cn(
            "z-40 h-full flex flex-col bg-background border-l transition-all duration-300 overflow-hidden shrink-0",
            isInspectorOpen ? "w-80" : "w-0 border-none"
        )}>
            <div className="w-80 flex flex-col h-full shrink-0 overflow-hidden">
                <div className="p-4 h-14 border-b flex items-center justify-between bg-secondary/10">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Inspector</span>
                    </div>
                    {isLargeProject && (
                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full text-[8px] font-black uppercase">
                            <Gauge className="w-2.5 h-2.5" /> Performance Mode
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* TTS Configuration Section */}
                    <div className="p-4 border-b space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">TTS Engine</span>
                            <Select value={activeModelId} onValueChange={handleModelChange}>
                                <SelectTrigger className="h-9 text-[10px] font-bold uppercase">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {AVAILABLE_MODELS.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <VoiceSelector />
                        <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                <span>Pace</span>
                                <span>{playbackRate.toFixed(2)}x</span>
                            </div>
                            <input type="range" min="0.5" max="2.0" step="0.1" value={playbackRate} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="w-full h-1 accent-primary" />
                        </div>
                    </div>

                    {/* Studio Map Section */}
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <AlignLeft className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Studio Map</span>
                        </div>

                        <div className="space-y-2">
                            {chapters.map((chapter, index) => {
                                const isOpen = calculateChapterVisibility(
                                    chapter.id,
                                    index,
                                    chapters,
                                    userToggledChapters
                                );

                                const isPlayingInChapter = activeChunkId && chapter.chunks.some(c => c.id === activeChunkId);

                                return (
                                    <div key={chapter.id} className={cn(
                                        "border rounded-xl overflow-hidden transition-all duration-300",
                                        isPlayingInChapter ? "border-primary/40 bg-primary/[0.03]" : "border-border/40 bg-secondary/5"
                                    )}>
                                        <button
                                            onClick={() => toggleChapterManual(chapter.id, !isOpen)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-secondary/10 text-left bg-transparent border-none cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={cn("w-1 h-3 rounded-full", isPlayingInChapter ? "bg-primary" : "bg-transparent")} />
                                                <span className={cn("text-[11px] font-bold truncate", !isOpen && "text-muted-foreground")}>
                                                    {chapter.title}
                                                </span>
                                            </div>
                                            {isOpen ? <ChevronDown className="w-3 h-3 opacity-30" /> : <ChevronRight className="w-3 h-3 opacity-30" />}
                                        </button>

                                        {isOpen && (
                                            <div className="px-3 pb-3 grid grid-cols-10 gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {chapter.chunks.map((chunk) => (
                                                    <button
                                                        key={chunk.id}
                                                        onClick={() => setScrollToChunkId(chunk.id!)}
                                                        className={cn(
                                                            "w-full aspect-square rounded-[1px] transition-all hover:scale-125 border-none p-0 cursor-pointer",
                                                            (chunk.id === activeChunkId && chunk.status === 'generated')? "ring-1 ring-primary ring-offset-1 bg-blue-500" :
                                                            chunk.status === 'generated' ? "bg-green-500/50" :
                                                            chunk.status === 'processing' ? "bg-amber-500 animate-pulse" : "bg-border/30"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-secondary/10">
                   <ExportDialog />
                </div>
            </div>
        </aside>
    );
};
