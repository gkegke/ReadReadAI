import type { StorageService } from './types';
import { file, dir } from 'opfs-tools';

export class OpfsStorageService implements StorageService {
  async init(): Promise<void> {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("OPFS not supported");
    }
  }

  async getRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    return await navigator.storage.getDirectory();
  }

  async saveFile(path: string, blob: Blob): Promise<void> {
    // Robustness: opfs-tools 'file' function can sometimes be undefined 
    // if the module import fails.
    if (typeof file !== 'function') {
        throw new Error("Storage library failed to load");
    }
    const f = file(path);
    await f.write(blob);
  }

  async readFile(path: string): Promise<Blob> {
    const buffer = await file(path).arrayBuffer();
    return new Blob([buffer]);
  }

  async exists(path: string): Promise<boolean> {
    return await file(path).exists();
  }

  async deleteFile(path: string): Promise<void> {
    await file(path).remove();
  }

  async deleteDirectory(path: string): Promise<void> {
    await dir(path).remove();
  }
}