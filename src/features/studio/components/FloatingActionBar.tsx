import React, { useEffect } from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useDeleteChunksMutation, useRegenerateChunksMutation } from '../../../shared/hooks/useMutations';
import { Button } from '../../../shared/components/ui/button';
import { Trash2, RefreshCw, X } from 'lucide-react';

export const FloatingActionBar: React.FC = () => {
    const { activeProjectId, selectedChunkIds, isSelectionMode, clearSelection } = useProjectStore();
    const { mutate: deleteChunks, isPending: isDeleting } = useDeleteChunksMutation();
    const { mutate: regenerateChunks, isPending: isRegenerating } = useRegenerateChunksMutation();

    // Escape hatch for quick UX exit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSelectionMode) {
                clearSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSelectionMode, clearSelection]);

    // Always show bar if selection mode is active to give an explicit exit hatch
    if (!isSelectionMode || !activeProjectId) return null;

    const handleDelete = () => {
        if (selectedChunkIds.length === 0) return;
        if (confirm(`Delete ${selectedChunkIds.length} chunks? This will shift all following chunk sequences.`)) {
            deleteChunks({ projectId: activeProjectId, chunkIds: selectedChunkIds }, {
                onSuccess: () => clearSelection()
            });
        }
    };

    const handleRegenerate = () => {
        if (selectedChunkIds.length === 0) return;
        regenerateChunks({ projectId: activeProjectId, chunkIds: selectedChunkIds }, {
            onSuccess: () => clearSelection()
        });
    };

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-xl border border-primary/20 p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-top-5">
            <span className="text-[11px] font-black uppercase tracking-widest px-3 text-primary">
                {selectedChunkIds.length} Selected
            </span>
            <div className="w-px h-6 bg-border" />
            
            <Button size="sm" variant="ghost" onClick={handleRegenerate} disabled={isRegenerating || selectedChunkIds.length === 0}>
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
            
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting || selectedChunkIds.length === 0} className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            
            <div className="w-px h-6 bg-border mx-1" />

            <Button size="sm" variant="ghost" onClick={clearSelection} className="hover:bg-secondary" title="Exit (Esc)">
                Exit
                <X className="w-4 h-4 ml-2" />
            </Button>
        </div>
    );
};