import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemState {
  storageMode: 'unknown' | 'opfs' | 'memory';
  activeModelId: string;
  isZenMode: boolean;
  isStorageFull: boolean;
  storageMetrics: {
      usageMb: number;
      quotaMb: number;
      percent: number;
  };
  setStorageMode: (mode: 'opfs' | 'memory') => void;
  setActiveModelId: (id: string) => void;
  setIsZenMode: (enabled: boolean) => void;
  setIsStorageFull: (full: boolean) => void;
  setStorageMetrics: (usage: number, quota: number) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      storageMode: 'unknown',
      activeModelId: 'kokoro-perf',
      isZenMode: true,
      isStorageFull: false,
      storageMetrics: { usageMb: 0, quotaMb: 0, percent: 0 },

      setStorageMode: (mode) => set({ storageMode: mode }),
      setActiveModelId: (id) => set({ activeModelId: id }),
      setIsZenMode: (enabled) => set({ isZenMode: enabled }),
      setIsStorageFull: (full) => set({ isStorageFull: full }),
      setStorageMetrics: (usage, quota) => set({
          storageMetrics: {
              usageMb: Math.round(usage / 1024 / 1024),
              quotaMb: Math.round(quota / 1024 / 1024),
              percent: Math.round((usage / quota) * 100)
          }
      }),
    }),
    {
      name: 'readread-system-v1',
      partialize: (state) => ({
        activeModelId: state.activeModelId,
        isZenMode: state.isZenMode
      }),
    }
  )
);
