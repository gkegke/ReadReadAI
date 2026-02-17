import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemState {
  storageMode: 'unknown' | 'opfs' | 'memory';
  activeModelId: string;
  /** [CRITICAL: EPIC 3] Zen Mode toggle for Studio Spotlight */
  isZenMode: boolean; 
  setStorageMode: (mode: 'opfs' | 'memory') => void;
  setActiveModelId: (id: string) => void;
  setIsZenMode: (enabled: boolean) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      storageMode: 'unknown',
      activeModelId: 'kitten-v0-q8', 
      isZenMode: true, // Default to enabled for high-end feel
      
      setStorageMode: (mode) => set({ storageMode: mode }),
      setActiveModelId: (id) => set({ activeModelId: id }),
      setIsZenMode: (enabled) => set({ isZenMode: enabled }),
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