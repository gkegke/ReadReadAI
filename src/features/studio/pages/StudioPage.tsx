import React, { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { Timeline } from '../components/Timeline';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { projectRoute } from '../../../app/router';

/**
 * StudioPage
 * Corrected the named import of Timeline to match the updated export.
 */
export const StudioPage: React.FC = () => {
    const { projectId } = useParams({ from: projectRoute.id });
    const { setActiveProject } = useProjectStore();
    
    useEffect(() => {
        const id = parseInt(projectId);
        if (!isNaN(id)) {
            setActiveProject(id);
        }
        
        return () => {
            setActiveProject(null);
        };
    }, [projectId, setActiveProject]);

    return (
        <div className="h-full w-full bg-background overflow-hidden">
            <Timeline />
        </div>
    );
};