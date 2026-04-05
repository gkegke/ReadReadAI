import React, { useState, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { deriveChapters } from '../../../shared/lib/chapterUtils';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { Download, CheckCircle2, Circle, Loader2, Package } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

export const ExportDialog: React.FC = () => {
    const { activeProjectId } = useProjectStore();
    const { data: chunks = [] } = useProjectChunks(activeProjectId);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [open, setOpen] = useState(false);

    const chapters = useMemo(() => deriveChapters(chunks), [chunks]);

    const toggleChapter = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(chapters.map(c => c.id)));
    };

    const handleExport = async () => {
        if (!activeProjectId) return;
        setIsExporting(true);
        try {
            await ProjectRepository.exportProjectAudio(activeProjectId, Array.from(selectedIds));
            setOpen(false);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 font-bold uppercase tracking-widest text-[10px]">
                    <Download className="w-3.5 h-3.5" />
                    Export Audio
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Package Audio
                    </DialogTitle>
                    <DialogDescription>
                        Select the chapters you want to include in your sequential export.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                            {selectedIds.size} of {chapters.length} Chapters Selected
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={handleSelectAll}>
                            Select All
                        </Button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                        {chapters.map((ch) => {
                            const isSelected = selectedIds.has(ch.id);
                            const generated = ch.chunks.filter(c => c.status === 'generated').length;

                            return (
                                <button
                                    key={ch.id}
                                    onClick={() => toggleChapter(ch.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                                        isSelected ? "bg-primary/5 border-primary/30" : "bg-secondary/20 border-transparent hover:bg-secondary/40"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isSelected ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-muted-foreground/30" />}
                                        <span className={cn("text-xs font-bold truncate", !isSelected && "text-muted-foreground")}>
                                            {ch.title}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-mono opacity-50">
                                        {generated}/{ch.chunks.length} blocks
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || selectedIds.size === 0}
                        className="w-full h-12 rounded-2xl"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Compressing Audio...
                            </>
                        ) : (
                            `Download ${selectedIds.size} Chapters`
                        )}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground italic">
                        Files are encoded to Opus (.webm) for the best balance of quality and size.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
