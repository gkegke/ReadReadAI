import React, { useState, useRef } from 'react';
import { Plus, Send, X, Type, FileUp } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { useInsertBlockMutation } from '../../../shared/hooks/useMutations';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { cn } from '../../../shared/lib/utils';
import { logger } from '../../../shared/services/Logger';

interface InsertionPointProps {
    projectId: number;
    afterOrderIndex: number; 
}

export const InsertionPoint: React.FC<InsertionPointProps> = ({ projectId, afterOrderIndex }) => {
    const [isActive, setIsActive] = useState(false);
    const [tab, setTab] = useState<'paragraph' | 'heading' | 'file'>('paragraph');
    const [text, setText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    const { mutate: insertBlock, isPending } = useInsertBlockMutation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleInsertText = () => {
        if (!text.trim()) return;
        insertBlock({ text, projectId, afterOrderIndex, role: tab as 'paragraph'|'heading' }, {
            onSuccess: () => {
                setText('');
                setIsActive(false);
            }
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            await ProjectRepository.importDocument(file, projectId, afterOrderIndex);
            setIsActive(false);
        } catch (err) {
            logger.error('InsertionPoint', 'Failed mid-project file insertion', err);
            alert("Failed to insert document.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isActive) {
        return (
            <div className="mx-auto max-w-3xl w-full px-6 py-4 animate-in fade-in slide-in-from-top-2">
                <div className="bg-secondary/30 rounded-2xl border border-primary/20 p-4 shadow-xl">
                    <div className="flex gap-2 mb-4 bg-background p-1 rounded-lg w-fit border border-border/50">
                        <button onClick={() => setTab('paragraph')} className={cn("text-[10px] font-black uppercase px-4 py-1.5 rounded-md transition-all", tab === 'paragraph' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary')}>Text</button>
                        <button onClick={() => setTab('heading')} className={cn("text-[10px] font-black uppercase px-4 py-1.5 rounded-md transition-all flex items-center", tab === 'heading' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary')}><Type className="w-3 h-3 mr-1.5" />Heading</button>
                        <button onClick={() => setTab('file')} className={cn("text-[10px] font-black uppercase px-4 py-1.5 rounded-md transition-all flex items-center", tab === 'file' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary')}><FileUp className="w-3 h-3 mr-1.5" />Document</button>
                    </div>

                    {tab === 'file' ? (
                         <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-primary/20 rounded-xl bg-background/50 transition-colors hover:border-primary/40 hover:bg-secondary/30">
                            <FileUp className="w-8 h-8 text-primary/50 mb-3" />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Insert PDF or TXT</p>
                            <label className="cursor-pointer">
                                <Button asChild variant="secondary" size="sm" disabled={isUploading}>
                                    <span>{isUploading ? 'Processing...' : 'Browse File'}</span>
                                </Button>
                                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.html" onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        </div>
                    ) : (
                        <textarea
                            autoFocus
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className={cn(
                                "w-full bg-transparent border-none focus:ring-0 resize-none min-h-[80px]",
                                tab === 'heading' ? "text-2xl font-black font-sans text-primary" : "text-lg font-serif"
                            )}
                            placeholder={tab === 'heading' ? "Enter heading..." : "Insert thoughts here..."}
                        />
                    )}
                    
                    <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border/50">
                        <Button variant="ghost" size="sm" onClick={() => setIsActive(false)} disabled={isPending || isUploading}>
                            <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                        {tab !== 'file' && (
                            <Button size="sm" onClick={handleInsertText} disabled={isPending || !text.trim()}>
                                <Send className="w-3.5 h-3.5 mr-2" /> 
                                {isPending ? 'Processing...' : 'Insert'}
                            </Button>
                        )}
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