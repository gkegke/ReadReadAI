import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInsertBlockMutation } from '../../../shared/hooks/useMutations';
import { useServices } from '../../../shared/context/ServiceContext';
import { StudioBlockEditor } from './StudioBlockEditor';

interface InsertionPointProps {
    projectId: number;
    afterOrderIndex: number;
}

export const InsertionPoint: React.FC<InsertionPointProps> = ({ projectId, afterOrderIndex }) => {
    const [isActive, setIsActive] = useState(false);
    const [text, setText] = useState('');

    const { mutate: insertBlock, isPending } = useInsertBlockMutation();
    const { queue } = useServices();

    const handleInsert = () => {
        if (!text.trim()) {
            setIsActive(false);
            return;
        }

        // Detect role based on TinyReadRead convention
        const role = text.trim().startsWith('#') ? 'heading' : 'paragraph';
        const cleanText = role === 'heading' ? text.trim().replace(/^#\s*/, '') : text;

        insertBlock({ text: cleanText, projectId, afterOrderIndex, role }, {
            onSuccess: () => {
                setText('');
                setIsActive(false);
                queue.poke();
            }
        });
    };

    if (isActive) {
        return (
            <div className="mx-auto max-w-4xl w-full px-16 py-4 animate-in fade-in slide-in-from-top-2">
                <StudioBlockEditor
                    role={text.trim().startsWith('#') ? 'heading' : 'paragraph'}
                    value={text}
                    onChange={setText}
                    onSave={handleInsert}
                    onCancel={() => setIsActive(false)}
                    placeholder="Type here... Use '#' for a new chapter."
                />
            </div>
        );
    }

    return (
        <div className="group relative h-8 flex items-center justify-center">
            <div className="absolute inset-x-16 h-[1px] bg-primary/10 opacity-0 group-hover:opacity-100 transition-all" />
            <button
                onClick={() => setIsActive(true)}
                className="z-10 bg-background border border-border text-muted-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all shadow-sm hover:bg-primary hover:text-white"
            >
                <Plus className="w-4 h-4" strokeWidth={3} />
            </button>
        </div>
    );
};
