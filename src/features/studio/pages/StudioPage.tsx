import React, { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { Timeline } from '../components/Timeline';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { projectRoute } from '../../../app/router';
import { useServices } from '../../../shared/context/ServiceContext';

export const StudioPage: React.FC = () => {
    const { projectId } = useParams({ from: projectRoute.id });
    const { setActiveProject } = useProjectStore();
    const { stopAll } = useAudioStore();
    const { queue, logger } = useServices();
    
    useEffect(() => {
        const id = parseInt(projectId);
        if (!isNaN(id)) {
            setActiveProject(id);
        }
        
        return () => {
            logger.info('StudioPage', 'Unmounting Studio: Terminating playback and pausing queue.');
            // [FIX: ISSUE 1 & 3] Use the unified stopAll to clear store and service.
            stopAll();
            // [FIX: ISSUE 2] queue.stop() now properly destroys the worker reference.
            queue.stop();
            setActiveProject(null);
        };
    }, [projectId, setActiveProject, stopAll, queue, logger]);

    return (
        <div className="h-full w-full bg-background overflow-hidden">
            <Timeline />
        </div>
    );
};