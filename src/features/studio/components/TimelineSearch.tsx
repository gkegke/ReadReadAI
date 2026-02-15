import React, { useEffect, useState } from 'react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../../../shared/components/ui/command';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { FileText, Hash } from 'lucide-react';

export const TimelineSearch: React.FC = () => {
    const [open, setOpen] = useState(false);
    const { activeProjectId } = useProjectStore();
    const { setActiveChunkId } = useAudioStore();
    const { data: chunks } = useProjectChunks(activeProjectId);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const handleSelect = (chunkId: number) => {
        setActiveChunkId(chunkId);
        setOpen(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search text or Jump to chunk #..." />
            <CommandList>
                <CommandEmpty>No chunks found.</CommandEmpty>
                <CommandGroup heading="Timeline Chunks">
                    {chunks.map((chunk, index) => (
                        <CommandItem
                            key={chunk.id}
                            onSelect={() => handleSelect(chunk.id!)}
                            className="flex items-center gap-3 cursor-pointer"
                        >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-muted text-[10px] font-mono font-medium">
                                {index + 1}
                            </div>
                            <span className="truncate opacity-70 italic text-xs">
                                {chunk.textContent.slice(0, 60)}...
                            </span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
};