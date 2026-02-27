import React from 'react';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useDeleteChunksMutation, useRegenerateChunksMutation } from '../../../shared/hooks/useMutations';
import { Button } from '../../../shared/components/ui/button';
import { Trash2, RefreshCw, X } from 'lucide-react';

export const FloatingActionBar: React.FC = () => {
    const { activeProjectId, selectedChunkIds, clearSelection } = useProjectStore();
    const { mutate: deleteChunks, isPending: isDeleting } = useDeleteChunksMutation();
    const { mutate: regenerateChunks, isPending: isRegenerating } = useRegenerateChunksMutation();

    if (selectedChunkIds.length === 0 || !activeProjectId) return null;

    const handleDelete = () => {
        if (confirm(`Delete ${selectedChunkIds.length} chunks? This will shift all following chunk sequences.`)) {
            deleteChunks({ projectId: activeProjectId, chunkIds: selectedChunkIds }, {
                onSuccess: () => clearSelection()
            });
        }
    };

    const handleRegenerate = () => {
        regenerateChunks({ projectId: activeProjectId, chunkIds: selectedChunkIds }, {
            onSuccess: () => clearSelection()
        });
    };

    return (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-md border border-border p-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
            <span className="text-xs font-bold px-2">{selectedChunkIds.length} Selected</span>
            <div className="w-px h-6 bg-border" />
            
            <Button size="sm" variant="ghost" onClick={handleRegenerate} disabled={isRegenerating}>
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
            
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting} className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            
            <Button size="icon" variant="ghost" onClick={clearSelection} className="rounded-full shrink-0">
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
};