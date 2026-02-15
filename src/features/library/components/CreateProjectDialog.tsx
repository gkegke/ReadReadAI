import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';
import { ProjectRepository } from '../api/ProjectRepository';
import { Plus } from 'lucide-react';

export const CreateProjectDialog: React.FC<{ trigger?: React.ReactNode }> = ({ trigger }) => {
    const [name, setName] = useState('');
    const [open, setOpen] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await ProjectRepository.createProject(name);
        setName('');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="primary" size="sm" className="gap-2">
                        <Plus className="w-4 h-4" /> NEW PROJECT
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-4">
                    <input
                        autoFocus
                        placeholder="Project Name (e.g. My Audiobook)"
                        className="w-full bg-secondary/50 border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={!name.trim()}>Create Project</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};