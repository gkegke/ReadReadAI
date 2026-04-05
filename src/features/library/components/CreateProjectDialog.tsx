import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';
import { ProjectRepository } from '../api/ProjectRepository';
import { Plus, FolderPlus } from 'lucide-react';

export const CreateProjectDialog: React.FC = () => {
    const [name, setName] = useState('');
    const [open, setOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        await ProjectRepository.createProject(name);
        setName('');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto font-black tracking-widest text-xs h-12 px-6 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                    <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
                    NEW PROJECT
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-primary" />
                        Initialize Studio
                    </DialogTitle>
                    <DialogDescription>
                        Give your project a name. You can import documents or paste text once inside.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                            Project Name
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q3 Strategy Report"
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={!name.trim()} className="px-8">Create</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
