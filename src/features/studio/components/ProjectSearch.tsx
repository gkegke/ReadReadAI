import React, { useState, useMemo } from 'react';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger,
    PopoverAnchor
} from '../../../shared/components/ui/popover';
import { cn } from '../../../shared/lib/utils';
import { logger } from '../../../shared/services/Logger';

/**
 * ProjectSearch (V2.1 - Navigation Polish)
 * [UX] Accessible search interface that replaces the hidden Cmd+K palette.
 * Updated to solely handle navigation (scrolling) rather than forcing playback.
 */
export const ProjectSearch: React.FC = () => {
    const { activeProjectId, setScrollToChunkId } = useProjectStore();
    const { data: chunks } = useProjectChunks(activeProjectId);
    
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filteredChunks = useMemo(() => {
        if (!query.trim()) return [];
        const lowerQ = query.toLowerCase();
        return chunks.filter(c => c.textContent.toLowerCase().includes(lowerQ)).slice(0, 8);
    }, [chunks, query]);

    const handleSelect = (chunkId: number) => {
        logger.info('ProjectSearch', 'User navigated to chunk via search', { chunkId });
        setScrollToChunkId(chunkId); // Safely scroll without triggering TTS playback
        setIsOpen(false);
        setQuery('');
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverAnchor asChild>
                <div className={cn(
                    "flex items-center transition-all duration-300 ease-in-out h-9 rounded-lg border",
                    isOpen ? "w-[320px] bg-secondary/80 border-primary/30 px-3 shadow-inner" : "w-32 bg-secondary/30 border-transparent px-2 hover:bg-secondary/50"
                )}>
                    <Search className={cn("w-4 h-4 shrink-0 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (!isOpen) setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Search text..."
                        className="bg-transparent border-none outline-none text-xs flex-1 h-full px-2 placeholder:text-muted-foreground/50"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="hover:text-primary opacity-50 hover:opacity-100">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </PopoverAnchor>

            <PopoverContent 
                side="bottom" 
                align="start" 
                className="w-[320px] p-1 bg-background/95 backdrop-blur-xl border-border shadow-2xl"
                onOpenAutoFocus={(e) => e.preventDefault()} // Keep focus on the input
            >
                {filteredChunks.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            {query ? 'No results found' : 'Start typing to search'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="px-3 py-2 border-b border-border/50">
                            <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Matches in Timeline</span>
                        </div>
                        {filteredChunks.map((chunk) => (
                            <button
                                key={chunk.id}
                                onClick={() => handleSelect(chunk.id!)}
                                className="w-full text-left px-3 py-3 text-xs hover:bg-primary/5 transition-colors flex items-start gap-3 group border-b border-border/30 last:border-0"
                            >
                                <div className="mt-0.5 flex h-5 w-7 shrink-0 items-center justify-center rounded bg-secondary text-[9px] font-mono font-bold group-hover:bg-primary group-hover:text-primary-foreground">
                                    {chunk.orderInProject + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 italic font-serif">
                                        "{chunk.textContent}"
                                    </p>
                                </div>
                                <CornerDownLeft className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity self-center" />
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};