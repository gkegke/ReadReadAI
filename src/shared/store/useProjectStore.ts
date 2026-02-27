import { create } from 'zustand';

interface ProjectState {
  activeProjectId: number | null;
  activeChapterId: number | null;
  isExporting: boolean;
  selectedChunkIds: number[]; // [EPIC 3] Multi-select array
  
  setActiveProject: (id: number | null) => void;
  setActiveChapter: (id: number | null) => void;
  setExporting: (isExporting: boolean) => void;
  toggleChunkSelection: (id: number) => void;
  clearSelection: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  activeChapterId: null,
  isExporting: false,
  selectedChunkIds: [],

  setActiveProject: (id) => set({ 
    activeProjectId: id,
    activeChapterId: null,
    selectedChunkIds: [] // Clean up selection when pivoting contexts
  }),

  setActiveChapter: (id) => set({ activeChapterId: id }),

  setExporting: (isExporting) => set({ isExporting }),

  toggleChunkSelection: (id) => set((state) => ({
      selectedChunkIds: state.selectedChunkIds.includes(id)
        ? state.selectedChunkIds.filter(x => x !== id)
        : [...state.selectedChunkIds, id]
  })),

  clearSelection: () => set({ selectedChunkIds: [] }),
}));