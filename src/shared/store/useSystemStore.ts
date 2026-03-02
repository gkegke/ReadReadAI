import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemState {
  storageMode: 'unknown' | 'opfs' | 'memory';
  activeModelId: string;
  isZenMode: boolean; 
  /** [EPIC 6] Stops generation to prevent OPFS crashes */
  isStorageFull: boolean; 
  setStorageMode: (mode: 'opfs' | 'memory') => void;
  setActiveModelId: (id: string) => void;
  setIsZenMode: (enabled: boolean) => void;
  setIsStorageFull: (full: boolean) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      storageMode: 'unknown',
      activeModelId: 'kitten-v0-q8', 
      isZenMode: true, 
      isStorageFull: false,
      
      setStorageMode: (mode) => set({ storageMode: mode }),
      setActiveModelId: (id) => set({ activeModelId: id }),
      setIsZenMode: (enabled) => set({ isZenMode: enabled }),
      setIsStorageFull: (full) => set({ isStorageFull: full }),
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