import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '../../../shared/components/ui/dialog';
import { Button } from '../../../shared/components/ui/button';
import { useSystemStore } from '../../../shared/store/useSystemStore';
import { Settings, Eye, Type, AlignLeft, Info, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { ProjectRepository } from '../../library/api/ProjectRepository';

/**
 * SettingsMenu (Epic 3 & Phase 2)
 * Centralized control for Studio ergonomics and UX preferences + Danger Zone functions.
 */
export const SettingsMenu: React.FC = () => {
    const { isZenMode, setIsZenMode } = useSystemStore();
    const { activeProjectId } = useProjectStore();
    const navigate = useNavigate();

    const handleDeleteProject = async () => {
        if (!activeProjectId) return;
        if (window.confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
            await ProjectRepository.deleteProject(activeProjectId);
            navigate({ to: '/' });
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Studio Settings">
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Studio Preferences
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    {/* Active Feature: Zen Mode */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-primary" />
                                <span className="text-sm font-bold uppercase tracking-tight">Active Spotlight</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Focus on playing content by dimming surrounding cells.</p>
                        </div>
                        <button 
                            onClick={() => setIsZenMode(!isZenMode)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${isZenMode ? 'bg-primary' : 'bg-secondary'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-background rounded-full transition-transform ${isZenMode ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="h-[1px] bg-border" />

                    {/* Placeholder Features (Epic 3 Roadmap) */}
                    <div className="space-y-4 opacity-40 grayscale pointer-events-none">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Type className="w-4 h-4" />
                                <span className="text-sm font-bold uppercase tracking-tight">Font Scale</span>
                            </div>
                            <span className="text-[10px] font-black bg-secondary px-2 py-0.5 rounded">FUTURE</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlignLeft className="w-4 h-4" />
                                <span className="text-sm font-bold uppercase tracking-tight">Line Height</span>
                            </div>
                            <span className="text-[10px] font-black bg-secondary px-2 py-0.5 rounded">FUTURE</span>
                        </div>
                    </div>

                    <div className="bg-secondary/30 p-3 rounded-lg flex gap-3">
                        <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground leading-normal">
                            Preferences are saved locally to your browser profile. They do not sync across devices.
                        </p>
                    </div>

                    {/* [UX-PHASE-2] Danger Zone */}
                    <div className="h-[1px] bg-border" />
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-bold uppercase tracking-tight text-destructive">Danger Zone</span>
                        </div>
                        <Button 
                            variant="destructive" 
                            className="w-full text-xs font-bold tracking-widest uppercase" 
                            onClick={handleDeleteProject}
                        >
                            Delete Project
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};