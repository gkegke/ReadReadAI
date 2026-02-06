import { create } from 'zustand';

interface ProjectState {
  activeProjectId: number | null;
  isExporting: boolean;
  
  setActiveProject: (id: number | null) => void;
  setExporting: (isExporting: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  isExporting: false,

  setActiveProject: (id) => set({ activeProjectId: id }),
  setExporting: (isExporting) => set({ isExporting }),
}));