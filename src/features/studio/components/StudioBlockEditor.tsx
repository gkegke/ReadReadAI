import React, { useEffect, useRef } from 'react';
import { cn } from '../../../shared/lib/utils';
import { Button } from '../../../shared/components/ui/button';
import { Loader2 } from 'lucide-react';

interface StudioBlockEditorProps {
    value: string;
    onChange: (val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    role?: 'heading' | 'paragraph';
    isPending?: boolean;
    placeholder?: string;
}

export const StudioBlockEditor: React.FC<StudioBlockEditorProps> = ({
    value,
    onChange,
    onSave,
    onCancel,
    isPending,
    placeholder = "Type here..."
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isHeading = value.trim().startsWith('#');

    const adjustHeight = () => {
        const node = textareaRef.current;
        if (node) {
            node.style.height = 'auto'; // Reset to measure raw scrollHeight

            const maxHeight = window.innerHeight * 0.4;
            const scrollHeight = node.scrollHeight;

            if (scrollHeight > maxHeight) {
                node.style.height = `${maxHeight}px`;
                node.style.overflowY = 'auto';
            } else {
                node.style.height = `${scrollHeight}px`;
                node.style.overflowY = 'hidden';
            }
        }
    };

    useEffect(() => { adjustHeight(); }, [value]);
    useEffect(() => { textareaRef.current?.focus(); }, []);

    return (
        <div
            className="bg-secondary/30 rounded-2xl border border-primary/20 p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPaste={(e) => {
                    e.stopPropagation();
                }}
                className={cn(
                    "w-full bg-transparent border-none focus:ring-0 resize-none transition-all duration-300 p-2 scrollbar-hide",
                    isHeading
                        ? "text-3xl font-black font-sans text-primary leading-tight"
                        : "text-2xl font-serif leading-relaxed text-foreground",
                )}
                placeholder={placeholder}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSave();
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                    }
                }}
            />
            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
                <Button size="sm" onClick={onSave} disabled={isPending || !value.trim()} className="rounded-full px-6">
                    {isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                    Save
                </Button>
            </div>
        </div>
    );
};
