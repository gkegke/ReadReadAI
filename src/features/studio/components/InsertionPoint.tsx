import React, { useState } from 'react';
import { Plus, Send, X } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { useImportTextMutation } from '../../../shared/hooks/useMutations';
import { cn } from '../../../shared/lib/utils';

interface InsertionPointProps {
    projectId: number;
    chapterId: number | null;
    afterOrderIndex: number; // Insert after this index
}

/**
 * InsertionPoint (Epic 3: Story 1)
 * A hover-triggered zone between blocks that allows for non-linear content addition.
 */
export const InsertionPoint: React.FC<InsertionPointProps> = ({ 
    projectId, 
    chapterId, 
    afterOrderIndex 
}) => {
    const [isActive, setIsActive] = useState(false);
    const [text, setText] = useState('');
    const { mutate: importText, isPending } = useImportTextMutation();

    const handleInsert = () => {
        if (!text.trim()) return;
        // The ImportTextMutation handles the heavy lifting of chunking and indexing.
        // For the V1 of Epic 3, we simply append or insert.
        importText(text, {
            onSuccess: () => {
                setText('');
                setIsActive(false);
            }
        });
    };

    if (isActive) {
        return (
            <div className="mx-auto max-w-3xl w-full px-6 py-4 animate-in fade-in slide-in-from-top-2">
                <div className="bg-secondary/30 rounded-2xl border border-primary/20 p-4 shadow-xl">
                    <textarea
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-lg font-serif resize-none min-h-[80px]"
                        placeholder="Insert thoughts here..."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsActive(false)}>
                            <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleInsert} disabled={isPending || !text.trim()}>
                            <Send className="w-3.5 h-3.5 mr-2" /> 
                            {isPending ? 'Processing...' : 'Insert'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative h-4 flex items-center justify-center">
            <div className="absolute inset-x-0 h-[1px] bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
                onClick={() => setIsActive(true)}
                className="z-10 bg-background border border-border rounded-full p-1 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all hover:bg-primary hover:text-primary-foreground shadow-sm"
            >
                <Plus className="w-3 h-3" strokeWidth={3} />
            </button>
        </div>
    );
};