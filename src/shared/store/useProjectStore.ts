import { create } from 'zustand';

interface ProjectState {
  activeProjectId: number | null;
  scrollToChunkId: number | null; 
  isExporting: boolean;
  selectedChunkIds: number[]; 
  isSelectionMode: boolean;
  isInspectorOpen: boolean;
  
  setActiveProject: (id: number | null) => void;
  setScrollToChunkId: (id: number | null) => void;
  setExporting: (isExporting: boolean) => void;
  toggleChunkSelection: (id: number) => void;
  setSelectionMode: (isActive: boolean) => void;
  clearSelection: () => void;
  toggleInspector: () => void;
  setInspectorOpen: (isOpen: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  scrollToChunkId: null,
  isExporting: false,
  selectedChunkIds: [],
  isSelectionMode: false,
  // Always true so users see the integration dashboard when a project opens
  isInspectorOpen: true,

  setActiveProject: (id) => set({ 
    activeProjectId: id,
    scrollToChunkId: null,
    selectedChunkIds: [],
    isSelectionMode: false
  }),

  setScrollToChunkId: (id) => set({ scrollToChunkId: id }),

  setExporting: (isExporting) => set({ isExporting }),

  toggleChunkSelection: (id) => set((state) => ({
      selectedChunkIds: state.selectedChunkIds.includes(id)
        ? state.selectedChunkIds.filter(x => x !== id)
        : [...state.selectedChunkIds, id]
  })),

  setSelectionMode: (isActive) => set({ 
      isSelectionMode: isActive,
      selectedChunkIds: isActive ? [] : []
  }),

  clearSelection: () => set({ selectedChunkIds: [], isSelectionMode: false }),
  
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  
  setInspectorOpen: (isOpen) => set({ isInspectorOpen: isOpen }),
}));