import React from 'react';
import { useTTSStore } from '../../tts/store/useTTSStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { ProjectRepository } from '../../library/api/ProjectRepository';
import { Mic2, Check } from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '../../../shared/components/ui/select';
import { logger } from '../../../shared/services/Logger';

/**
 * VoiceSelector
 * [UX] Specific voice selection for the active model (e.g. Kokoro has ~10 voices).
 * Previously hidden in Command Palette.
 */
export const VoiceSelector: React.FC = () => {
    const { availableVoices } = useTTSStore();
    const { activeProjectId } = useProjectStore();
    // In a real implementation, we would fetch the current project's voice setting
    // For now, we default to the first available or a stored preference.
    
    const handleVoiceChange = async (voiceId: string) => {
        if (!activeProjectId) return;
        
        logger.info('VoiceSelector', 'Switching Project Voice', { voiceId });
        
        // Update project settings so new chunks use this voice
        await ProjectRepository.update(activeProjectId, {
            voiceSettings: { voiceId, speed: 1.0 } // Preserving speed would require reading project first
        });
        
        // Note: Existing chunks need to be regenerated manually or via a "Regenerate All" action
        // This keeps the "Immutable by default" philosophy unless explicitly requested.
    };

    if (availableVoices.length === 0) return null;

    return (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-md px-2 h-8 border border-border/50">
            <Mic2 className="w-3 h-3 text-muted-foreground" />
            <Select onValueChange={handleVoiceChange} defaultValue={availableVoices[0]?.id}>
                <SelectTrigger className="w-[120px] border-none bg-transparent h-7 text-[10px] font-bold uppercase tracking-tight focus:ring-0">
                    <SelectValue placeholder="Select Voice" />
                </SelectTrigger>
                <SelectContent>
                    {availableVoices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id} className="text-xs">
                            <span className="flex items-center gap-2">
                                {voice.name}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};