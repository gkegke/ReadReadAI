import type { StorageService } from './types';
import { OpfsStorageService } from './OpfsStorage';
import { MemoryStorageService } from './MemoryStorage';
import { useSystemStore } from '../../store/useSystemStore';

let instance: StorageService | null = null;
let initPromise: Promise<void> | null = null;

async function initializeStorageImplementation() {
  if (instance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const opfs = new OpfsStorageService();
      await opfs.init(); // This will throw if OPFS is broken
      
      instance = opfs;
      useSystemStore.getState().setStorageMode('opfs');
      console.log("[Storage] Using OPFS (Persistent)");
    } catch (e) {
      console.warn("[Storage] Fallback to Memory due to:", e);
      instance = new MemoryStorageService();
      await instance.init();
      useSystemStore.getState().setStorageMode('memory');
    }
  })();

  await initPromise;
}

export const storage: StorageService = {
  init: initializeStorageImplementation,
  
  // Proxy methods ensure initialization happened
  getRootHandle: async () => { await initializeStorageImplementation(); return instance!.getRootHandle(); },
  saveFile: async (p, b) => { await initializeStorageImplementation(); return instance!.saveFile(p, b); },
  readFile: async (p) => { await initializeStorageImplementation(); return instance!.readFile(p); },
  exists: async (p) => { await initializeStorageImplementation(); return instance!.exists(p); },
  deleteFile: async (p) => { await initializeStorageImplementation(); return instance!.deleteFile(p); },
  deleteDirectory: async (p) => { await initializeStorageImplementation(); return instance!.deleteDirectory(p); },
  // [CRITICAL FIX] Map the listDirectory API to the underlying instance
  listDirectory: async (p) => { await initializeStorageImplementation(); return instance!.listDirectory(p); }
};

export type * from './types';