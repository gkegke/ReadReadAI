import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Project, Chunk } from '../types/schema';

export const useProjects = () => {
    const data = useLiveQuery(
        () => db.projects.orderBy('createdAt').reverse().toArray(),
        []
    );
    return { data: data || [], isLoading: data === undefined };
};

export const useProject = (id: number | null) => {
    const data = useLiveQuery(
        async () => (id ? await db.projects.get(id) : undefined),
        [id]
    );
    return { data, isLoading: id !== null && data === undefined };
};

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
    
    return { data: data || [], isLoading: projectId !== null && data === undefined };
};

export const useProjectChunkIds = (projectId: number | null) => {
    const data = useLiveQuery(
        async () => {
            if (projectId === null) return [];
            const collection = db.chunks.where('projectId').equals(projectId);
            const chunks = await collection.primaryKeys();
            return chunks as number[];
        },
        [projectId]
    );
    
    return { data: data || [], isLoading: projectId !== null && data === undefined };
};

export const useChunk = (chunkId: number) => {
    const data = useLiveQuery(() => db.chunks.get(chunkId), [chunkId]);
    return { data, isLoading: data === undefined };
};

export const useGlobalJobStatus = () => {
    const status = useLiveQuery(async () => {
        const pendingCount = await db.jobs.where('status').anyOf('pending', 'processing').count();
        const processingCount = await db.jobs.where('status').equals('processing').count();
            
        return { isWorking: pendingCount > 0, pendingCount, processingCount };
    }, []);

    return status || { isWorking: false, pendingCount: 0, processingCount: 0 };
};