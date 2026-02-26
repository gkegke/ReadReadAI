import { useEffect } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunkIds } from '../../../shared/hooks/useQueries';
import { useServices } from '../../../shared/context/ServiceContext';

/**
 * useKeyboardShortcuts
 * [REFACTOR] Removed Power User Cmd+K. 
 * Focused purely on playback ergonomics (Space, J, K).
 */
export const useKeyboardShortcuts = () => {
    const { activeProjectId } = useProjectStore();
    const { activeChunkId, setActiveChunkId } = useAudioStore();
    const { playback } = useServices();
    const { data: chunkIds } = useProjectChunkIds(activeProjectId);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input, textarea, or contentEditable
            const target = e.target as HTMLElement;
            const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
            
            if (isInput && e.key !== 'Escape') return;

            // [DELETED] Command Palette Trigger
            
            if (!chunkIds || chunkIds.length === 0) return;

            const currentIndex = activeChunkId ? chunkIds.indexOf(activeChunkId) : -1;

            switch (e.key.toLowerCase()) {
                case 'j': // Next Chunk
                    e.preventDefault();
                    const nextIdx = Math.min(currentIndex + 1, chunkIds.length - 1);
                    setActiveChunkId(chunkIds[nextIdx]);
                    break;

                case 'k': // Previous Chunk
                    e.preventDefault();
                    const prevIdx = Math.max(currentIndex - 1, 0);
                    setActiveChunkId(chunkIds[prevIdx]);
                    break;

                case ' ': // Toggle Play/Pause
                    e.preventDefault();
                    if (activeChunkId) {
                        playback.toggle();
                    } else if (chunkIds.length > 0) {
                        setActiveChunkId(chunkIds[0]);
                    }
                    break;

                case 'escape':
                    // Global blur
                    (document.activeElement as HTMLElement)?.blur();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [chunkIds, activeChunkId, setActiveChunkId, playback]);
};