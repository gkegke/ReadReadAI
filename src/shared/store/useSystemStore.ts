import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemState {
  storageMode: 'unknown' | 'opfs' | 'memory';
  activeModelId: string;
  setStorageMode: (mode: 'opfs' | 'memory') => void;
  setActiveModelId: (id: string) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      storageMode: 'unknown',
      // Default to Kitten as it is lighter and faster for a "Studio" feel initially
      activeModelId: 'kitten-v0-q8', 
      
      setStorageMode: (mode) => set({ storageMode: mode }),
      setActiveModelId: (id) => set({ activeModelId: id }),
    }),
    {
      name: 'readread-system-v1', 
      partialize: (state) => ({ activeModelId: state.activeModelId }), 
    }
  )
);