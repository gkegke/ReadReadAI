import { create } from 'zustand';

interface ProjectState {
  activeProjectId: number | null;
  scrollToChunkId: number | null; 
  isExporting: boolean;
  selectedChunkIds: number[]; 
  isSelectionMode: boolean; // [Epic 3] Toggles safe bulk-selection UX
  isInspectorOpen: boolean; // [UX] Toggles sidebar visibility
  
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
  // [RESPONSIVE] Default to closed on mobile devices to save screen real estate
  isInspectorOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,

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