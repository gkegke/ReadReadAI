import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Project, Chunk } from '../types/schema';

/**
 * Standardized Data Access Layer
 * Wraps Dexie's useLiveQuery to provide consistent data + loading states.
 */

// --- PROJECTS ---

export const useProjects = () => {
    const data = useLiveQuery(
        () => db.projects.orderBy('createdAt').reverse().toArray(),
        []
    );
    return {
        data: data || [],
        isLoading: data === undefined
    };
};

export const useProject = (id: number | null) => {
    const data = useLiveQuery(
        async () => (id ? await db.projects.get(id) : undefined),
        [id]
    );
    return {
        data,
        isLoading: id !== null && data === undefined
    };
};

// --- CHUNKS ---

/**
 * CRITICAL: Bulk Data Fetch (For Timeline)
 * Returns the full Chunk objects for a project in a single reactive query.
 * Used by Timeline.tsx to prevent the N+1 query problem.
 */
export const useProjectChunks = (projectId: number | null) => {
    const data = useLiveQuery(
        async () => {
            if (projectId === null) return [];
            return await db.chunks
                .where('projectId')
                .equals(projectId)
                .sortBy('orderInProject');
        },
        [projectId]
    );
    
    return {
        data: data || [],
        isLoading: projectId !== null && data === undefined
    };
};

/**
 * Optimized for Navigation (For PlayerControls/Sidebar)
 * Returns only an array of IDs. 
 * This is better for navigation UI as it doesn't trigger re-renders 
 * when a chunk's text or synthesis status updates.
 */
export const useProjectChunkIds = (projectId: number | null) => {
    const data = useLiveQuery(
        async () => {
            if (projectId === null) return [];
            const chunks = await db.chunks
                .where('projectId')
                .equals(projectId)
                .primaryKeys(); // More efficient than fetching objects and mapping
            return chunks as number[];
        },
        [projectId]
    );
    
    return {
        data: data || [],
        isLoading: projectId !== null && data === undefined
    };
};

export const useChunk = (chunkId: number) => {
    const data = useLiveQuery(
        () => db.chunks.get(chunkId),
        [chunkId]
    );
    return {
        data,
        isLoading: data === undefined
    };
};

// --- JOBS & SYSTEM STATUS ---

export const useGlobalJobStatus = () => {
    const status = useLiveQuery(async () => {
        const pendingCount = await db.jobs
            .where('status')
            .anyOf('pending', 'processing')
            .count();
        
        const processingCount = await db.jobs
            .where('status')
            .equals('processing')
            .count();
            
        return {
            isWorking: pendingCount > 0,
            pendingCount,
            processingCount
        };
    }, []);

    return status || { isWorking: false, pendingCount: 0, processingCount: 0 };
};