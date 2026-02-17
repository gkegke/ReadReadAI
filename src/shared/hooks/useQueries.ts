import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Project, Chunk, Chapter } from '../types/schema';

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

// --- CHAPTERS ---

export const useProjectChapters = (projectId: number | null) => {
    const data = useLiveQuery(
        async () => {
            if (!projectId) return [];
            return await db.chapters
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

export const useChapter = (chapterId: number | null) => {
    const data = useLiveQuery(
        async () => (chapterId ? await db.chapters.get(chapterId) : undefined),
        [chapterId]
    );
    return {
        data,
        isLoading: chapterId !== null && data === undefined
    };
};

// --- CHUNKS ---

/**
 * [UPDATED] Hierarchical Chunk Fetching
 * If chapterId is provided, returns chunks for that chapter. 
 * Otherwise, returns all chunks for the project.
 */
export const useProjectChunks = (projectId: number | null, chapterId: number | null = null) => {
    const data = useLiveQuery(
        async () => {
            if (projectId === null) return [];
            
            if (chapterId) {
                return await db.chunks
                    .where('chapterId')
                    .equals(chapterId)
                    .sortBy('orderInProject');
            }

            return await db.chunks
                .where('projectId')
                .equals(projectId)
                .sortBy('orderInProject');
        },
        [projectId, chapterId]
    );
    
    return {
        data: data || [],
        isLoading: projectId !== null && data === undefined
    };
};

export const useProjectChunkIds = (projectId: number | null, chapterId: number | null = null) => {
    const data = useLiveQuery(
        async () => {
            if (projectId === null) return [];
            
            let collection;
            if (chapterId) {
                collection = db.chunks.where('chapterId').equals(chapterId);
            } else {
                collection = db.chunks.where('projectId').equals(projectId);
            }
            
            const chunks = await collection.primaryKeys();
            return chunks as number[];
        },
        [projectId, chapterId]
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