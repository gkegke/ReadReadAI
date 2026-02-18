import React, { useEffect, useState } from 'react';
import { 
    CommandDialog, 
    CommandInput, 
    CommandList, 
    CommandEmpty, 
    CommandGroup, 
    CommandItem,
    CommandSeparator
} from '../../../shared/components/ui/command';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { ChapterRepository } from '../../library/api/ChapterRepository';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { ttsService } from '../../tts/services/TTSService';
import { 
    FileText, 
    PlusCircle, 
    Download, 
    Mic2, 
    Zap, 
    Command as CommandIcon 
} from 'lucide-react';

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
}

/**
 * GlobalCommandPalette (Epic 4: Story 1)
 * Central command hub for project actions, navigation, and settings.
 */
export const GlobalCommandPalette: React.FC<Props> = ({ open, setOpen }) => {
    const { activeProjectId } = useProjectStore();
    const { setActiveChunkId } = useAudioStore();
    const { availableVoices } = useTTSStore();
    const { setActiveModelId } = useSystemStore();
    const { data: chunks } = useProjectChunks(activeProjectId);

    const handleSelectChunk = (chunkId: number) => {
        setActiveChunkId(chunkId);
        setOpen(false);
    };

    const handleCreateChapter = async () => {
        if (!activeProjectId) return;
        const name = prompt("Enter Section Name:");
        if (name) {
            await ChapterRepository.createChapter(activeProjectId, name);
            setOpen(false);
        }
    };

    const handleExport = async () => {
        if (!activeProjectId) return;
        setOpen(false);
        await ProjectRepository.exportProjectAudio(activeProjectId);
    };

    const handleVoiceChange = (voiceId: string) => {
        // In a real impl, we might update project settings or system-wide default
        console.log(`Switching to voice: ${voiceId}`);
        setOpen(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search text, voices, or actions..." />
            <CommandList className="max-h-[450px]">
                <CommandEmpty>No results found.</CommandEmpty>
                
                <CommandGroup heading="Actions">
                    <CommandItem onSelect={handleCreateChapter}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>New Section / Chapter</span>
                    </CommandItem>
                    <CommandItem onSelect={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        <span>Export Project (ZIP)</span>
                    </CommandItem>
                    <CommandItem onSelect={() => { window.print(); setOpen(false); }}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Print Transcript</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Voices">
                    {availableVoices.map(voice => (
                        <CommandItem key={voice.id} onSelect={() => handleVoiceChange(voice.id)}>
                            <Mic2 className="mr-2 h-4 w-4" />
                            <span>Switch to {voice.name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Timeline Content">
                    {chunks.map((chunk, index) => (
                        <CommandItem
                            key={chunk.id}
                            onSelect={() => handleSelectChunk(chunk.id!)}
                        >
                            <div className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-mono mr-3">
                                {index + 1}
                            </div>
                            <span className="truncate opacity-80 text-xs font-serif italic">
                                "{chunk.textContent.slice(0, 70)}..."
                            </span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
            
            <div className="flex items-center justify-between p-3 border-t border-border bg-secondary/20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background font-sans">J</kbd>
                        <kbd className="px-1.5 py-0.5 rounded border bg-background font-sans">K</kbd>
                        <span>Navigate</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background font-sans">Space</kbd>
                        <span>Play</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter opacity-40">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Power Mode</span>
                </div>
            </div>
        </CommandDialog>
    );
};