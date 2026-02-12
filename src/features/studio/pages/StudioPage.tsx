import React, { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { Timeline } from '../components/Timeline';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { usePlaybackEngine } from '../hooks/usePlaybackEngine';

export const StudioPage: React.FC = () => {
    const { projectId } = useParams({ from: '/project/$projectId' });
    const { setActiveProject } = useProjectStore();
    
    // Activate the "DJ" engine for this project
    usePlaybackEngine();

    useEffect(() => {
        const id = parseInt(projectId);
        if (!isNaN(id)) {
            setActiveProject(id);
        }
    }, [projectId, setActiveProject]);

    return (
        <div className="h-full w-full bg-background overflow-hidden">
            <Timeline />
        </div>
    );
};