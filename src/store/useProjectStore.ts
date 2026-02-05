import { create } from 'zustand';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Chunk } from '../types/schema';

interface ProjectState {
  activeProjectId: number | null;
  isProcessing: boolean;
  isExporting: boolean;
  
  setActiveProject: (id: number | null) => void;
  setProcessing: (isProcessing: boolean) => void;
  setExporting: (isExporting: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  isProcessing: false,
  isExporting: false,

  setActiveProject: (id) => set({ activeProjectId: id }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setExporting: (isExporting) => set({ isExporting }),
}));

// Hooks for Data Access

export const useProjects = () => 
    useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray());

// DEPRECATED: Use useActiveProjectChunkIds + ChunkItem query instead for large lists
export const useActiveProjectChunks = (projectId: number | null) => {
    return useLiveQuery(async () => {
        if (projectId === null) return [];
        return await db.chunks.where('projectId').equals(projectId).sortBy('orderInProject');
    }, [projectId]);
};

// NEW: Optimized Hook - Only returns IDs to prevent full list re-renders on status changes
export const useActiveProjectChunkIds = (projectId: number | null) => {
    return useLiveQuery(async () => {
        if (projectId === null) return [];
        const chunks = await db.chunks.where('projectId').equals(projectId).sortBy('orderInProject');
        return chunks.map(c => c.id!);
    }, [projectId]);
};