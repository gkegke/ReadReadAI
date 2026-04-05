import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectState {
    activeProjectId: number | null;
    scrollToChunkId: number | null;

    setActiveProject: (id: number | null) => void;
    setScrollToChunkId: (id: number | null) => void;
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            activeProjectId: null,
            scrollToChunkId: null,

            setActiveProject: (id) => set({ activeProjectId: id }),
            setScrollToChunkId: (id) => set({ scrollToChunkId: id }),
        }),
        {
            name: "readread-project-context-v1",
            // We persist the active ID so a page refresh doesn't lose context
            partialize: (state) => ({ activeProjectId: state.activeProjectId }),
        }
    )
);
