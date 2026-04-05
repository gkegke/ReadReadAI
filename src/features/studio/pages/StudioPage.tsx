import React, { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { Timeline } from '../components/Timeline';
import { PlayerControls } from '../components/PlayerControls';
import { projectRoute } from '../../../app/router';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { useServices } from '../../../shared/context/ServiceContext';
import { usePlaybackEngine } from '../hooks/usePlaybackEngine';

export const StudioPage: React.FC = () => {
    const { projectId } = useParams({ from: projectRoute.id });
    const { setActiveProject } = useProjectStore();
    const { stopAll } = useAudioStore();
    const { queue, logger } = useServices();

    // Initialize the gapless lookahead engine
    usePlaybackEngine();

    useEffect(() => {
        const id = parseInt(projectId);
        if (!isNaN(id)) setActiveProject(id);

        return () => {
            logger.info('StudioPage', 'Unmounting Studio: Terminating playback and workers.');
            stopAll();
            queue.stop();
            setActiveProject(null);
        };
    }, [projectId, setActiveProject, stopAll, queue, logger]);

    return (
        <div className="h-full w-full bg-background overflow-hidden relative">
            <Timeline />
            <PlayerControls />
        </div>
    );
};
