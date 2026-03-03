import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemState {
  storageMode: 'unknown' | 'opfs' | 'memory';
  activeModelId: string;
  isZenMode: boolean; 
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
      activeModelId: 'kokoro-v1-q8', // Default fixed to Kokoro
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