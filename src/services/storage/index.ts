import type { StorageService } from './types';
import { OpfsStorageService } from './OpfsStorage';
import { MemoryStorageService } from './MemoryStorage';
import { useSystemStore } from '../../store/useSystemStore';

let instance: StorageService | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

async function initializeStorageImplementation() {
  if (instance) return;
  
  if (isInitializing && initPromise) {
      await initPromise;
      return;
  }

  isInitializing = true;
  
  initPromise = (async () => {
    try {
      const opfs = new OpfsStorageService();
      await opfs.init();
      
      const testFile = '.health_check';
      await opfs.saveFile(testFile, new Blob(['ok']));
      await opfs.deleteFile(testFile);

      instance = opfs;
      useSystemStore.getState().setStorageMode('opfs');
      console.log("[Storage] Using OPFS (Persistent)");
    } catch (e) {
      console.warn("[Storage] OPFS unavailable. Falling back to Memory.", e);
      instance = new MemoryStorageService();
      useSystemStore.getState().setStorageMode('memory');
    } finally {
      isInitializing = false;
    }
  })();

  await initPromise;
}

export const storage: StorageService = {
  init: async () => {
    await initializeStorageImplementation();
  },

  getRootHandle: async () => {
    if (!instance) await initializeStorageImplementation();
    return instance!.getRootHandle();
  },

  saveFile: async (path, blob) => {
    if (!instance) await initializeStorageImplementation();
    return instance!.saveFile(path, blob);
  },

  readFile: async (path) => {
    if (!instance) await initializeStorageImplementation();
    return instance!.readFile(path);
  },

  exists: async (path) => {
    if (!instance) await initializeStorageImplementation();
    return instance!.exists(path);
  },

  deleteFile: async (path) => {
    if (!instance) await initializeStorageImplementation();
    return instance!.deleteFile(path);
  },

  deleteDirectory: async (path) => {
    if (!instance) await initializeStorageImplementation();
    return instance!.deleteDirectory(path);
  }
};

export type * from './types';