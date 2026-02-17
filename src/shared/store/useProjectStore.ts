import { create } from 'zustand';

interface ProjectState {
  activeProjectId: number | null;
  activeChapterId: number | null; // [NEW] Scopes the current Studio view
  isExporting: boolean;
  
  setActiveProject: (id: number | null) => void;
  setActiveChapter: (id: number | null) => void; // [NEW]
  setExporting: (isExporting: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  activeChapterId: null,
  isExporting: false,

  setActiveProject: (id) => set({ 
    activeProjectId: id,
    activeChapterId: null // Reset chapter selection when switching projects
  }),

  setActiveChapter: (id) => set({ activeChapterId: id }),

  setExporting: (isExporting) => set({ isExporting }),
}));