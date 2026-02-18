import { useEffect } from 'react';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useProjectChunkIds } from '../../../shared/hooks/useQueries';
import { useServices } from '../../../shared/context/ServiceContext';
import { logger } from '../../../shared/services/Logger';

/**
 * useKeyboardShortcuts (Epic 4: Story 2)
 * Handles "Home Row" navigation and playback control.
 * J/K: Navigate | Space: Play/Pause | Cmd+K: Commands
 */
export const useKeyboardShortcuts = (onOpenCommandPalette: () => void) => {
    const { activeProjectId } = useProjectStore();
    const { activeChunkId, setActiveChunkId } = useAudioStore();
    const { playback } = useServices();
    const { data: chunkIds } = useProjectChunkIds(activeProjectId);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input or textarea
            const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
            if (isInput && e.key !== 'Escape') return;

            // Command Palette (Cmd/Ctrl + K)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                onOpenCommandPalette();
                return;
            }

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
                    // Prevent page scroll
                    e.preventDefault();
                    if (activeChunkId) {
                        playback.toggle();
                    } else if (chunkIds.length > 0) {
                        setActiveChunkId(chunkIds[0]);
                    }
                    break;

                case 'enter': // Forced focus if Shift is held
                    if (e.shiftKey && activeChunkId) {
                        playback.toggle();
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
    }, [chunkIds, activeChunkId, setActiveChunkId, playback, onOpenCommandPalette]);
};