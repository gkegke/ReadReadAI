import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
    isSidebarOpen: boolean;
    isInspectorOpen: boolean;
    isPlayerOpen: boolean;
    visibleChapterId: string | null;
    userToggledChapters: Record<string, boolean>;
    isZenMode: boolean;
    setIsZenMode: (enabled: boolean) => void;

    setSidebarOpen: (open: boolean) => void;
    setInspectorOpen: (open: boolean) => void;
    setPlayerOpen: (open: boolean) => void;
    setVisibleChapterId: (id: string | null) => void;
    toggleSidebar: () => void;
    toggleInspector: () => void;
    togglePlayer: () => void;
    toggleChapterManual: (chapterId: string, newState?: boolean) => void;
    resetManualToggles: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: true,
            isInspectorOpen: true,
            isPlayerOpen: true,
            isZenMode: true,
            visibleChapterId: null,
            userToggledChapters: {},

            setSidebarOpen: (open) => set({ isSidebarOpen: open }),
            setInspectorOpen: (open) => set({ isInspectorOpen: open }),
            setPlayerOpen: (open) => set({ isPlayerOpen: open }),
            setVisibleChapterId: (id) => set({ visibleChapterId: id }),
            setIsZenMode: (enabled) => set({ isZenMode: enabled }),
            toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
            togglePlayer: () => set((state) => ({ isPlayerOpen: !state.isPlayerOpen })),

            toggleChapterManual: (id, newState) => set((state) => {
                const existing = state.userToggledChapters[id];
                const isCurrentlyExpanded = existing ?? true;
                const nextState = newState !== undefined ? newState : !isCurrentlyExpanded;

                return {
                    userToggledChapters: {
                        ...state.userToggledChapters,
                        [id]: nextState
                    }
                };
            }),

            resetManualToggles: () => set({ userToggledChapters: {} })
        }),
        {
            name: "readread-ui-v4",
            partialize: (state) => ({
                isSidebarOpen: state.isSidebarOpen,
                isInspectorOpen: state.isInspectorOpen,
                isPlayerOpen: state.isPlayerOpen,
                isZenMode: state.isZenMode,
                userToggledChapters: state.userToggledChapters,
            }),
        }
    )
);
