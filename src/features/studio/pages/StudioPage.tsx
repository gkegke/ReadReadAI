import React, { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { Timeline } from '../components/Timeline';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { projectRoute } from '../../../app/router'; // [IMPORT: Type-safe route]

/**
 * StudioPage
 * The main canvas for audio synthesis and editing.
 */
export const StudioPage: React.FC = () => {
    // [FIX] Reference the route object directly to satisfy TanStack Router's invariant
    const { projectId } = useParams({ from: projectRoute.id });
    const { setActiveProject } = useProjectStore();
    
    useEffect(() => {
        const id = parseInt(projectId);
        if (!isNaN(id)) {
            setActiveProject(id);
        }
        
        // [CLEANUP] Ensure system state is reset when leaving the Studio
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