import React from 'react';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useUIStore } from '../../../shared/store/useUIStore';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { useRegenerateChunksMutation } from '../../../shared/hooks/useMutations';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { Mic2, RefreshCw } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/components/ui/select';
import { cn } from '../../../shared/lib/utils';

export const VoiceSelector: React.FC = () => {
    const { availableVoices } = useTTSStore();
    const { activeProjectId } = useProjectStore();
    const { userToggledChapters } = useUIStore();
    const { data: chunks = [] } = useProjectChunks(activeProjectId);
    const { mutate: regenerate, isPending } = useRegenerateChunksMutation();

    const handleVoiceChange = async (voiceId: string) => {
        if (!activeProjectId) return;
        await ProjectRepository.update(activeProjectId, {
            voiceSettings: { voiceId, speed: 1.0 }
        });
    };

    const handleRegenerateVisible = () => {
        if (!activeProjectId) return;
        let currentChapterId = "start";
        const visibleIds = chunks.filter(c => {
            if (c.role === 'heading') currentChapterId = String(c.id);
            // Chapters are visible unless explicitly set to false in userToggledChapters
            const isVisible = userToggledChapters[currentChapterId] !== false;
            return isVisible;
        }).map(c => c.id!);

        if (visibleIds.length > 0 && window.confirm(`Regenerate all ${visibleIds.length} visible blocks?`)) {
            regenerate({ projectId: activeProjectId, chunkIds: visibleIds });
        }
    };

    if (availableVoices.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 h-8 border border-border/50">
                <Mic2 className="w-3 h-3 text-muted-foreground" />
                <Select onValueChange={handleVoiceChange} defaultValue={availableVoices[0]?.id}>
                    <SelectTrigger className="w-full border-none bg-transparent h-7 text-[10px] font-bold uppercase tracking-tight focus:ring-0">
                        <SelectValue placeholder="Select Voice" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableVoices.map(voice => (
                            <SelectItem key={voice.id} value={voice.id} className="text-xs">
                                {voice.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateVisible}
                disabled={isPending || chunks.length === 0}
                className="w-full h-7 text-[9px] font-black tracking-widest text-muted-foreground hover:text-primary"
            >
                <RefreshCw className={cn("w-3 h-3 mr-2", isPending && "animate-spin")} />
                REGENERATE VISIBLE BLOCKS
            </Button>
        </div>
    );
};
