import type { StorageService } from './types';
import { getDirHandle, writeToHandle, readFromHandle } from '../../lib/storage-shared';

/**
 * Implementation of StorageService using the Origin Private File System (OPFS).
 */
export class OpfsStorageService implements StorageService {
  private root: FileSystemDirectoryHandle | null = null;

  async init(): Promise<void> {
    if (!this.root) {
      this.root = await navigator.storage.getDirectory();
    }
  }

  async getRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    await this.init();
    return this.root;
  }

  async saveFile(path: string, blob: Blob): Promise<void> {
    await this.init();
    if (!this.root) throw new Error("OPFS Root not initialized");
    await writeToHandle(this.root, path, blob);
  }

  async readFile(path: string): Promise<Blob> {
    await this.init();
    if (!this.root) throw new Error("OPFS Root not initialized");
    try {
        return await readFromHandle(this.root, path);
    } catch (error) {
        throw new Error(`File not found: ${path}`);
    }
  }

  async exists(path: string): Promise<boolean> {
      try {
          await this.readFile(path);
          return true;
      } catch (e) {
          return false;
      }
  }

  async deleteFile(path: string): Promise<void> {
    try {
        await this.init();
        if (!this.root) return;
        
        const parts = path.split('/').filter(p => p.length > 0);
        const filename = parts.pop();
        if (!filename) return;

        const dirPath = parts.join('/');
        const dirHandle = dirPath.length > 0 ? await getDirHandle(this.root, dirPath) : this.root;
        
        await dirHandle.removeEntry(filename);
    } catch (e) {
        console.warn(`Failed to delete file ${path}`, e);
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    try {
        await this.init();
        if (!this.root) return;

        const parts = path.split('/').filter(p => p.length > 0);
        const targetDirName = parts.pop();
        if(!targetDirName) return;

        const parentPath = parts.join('/');
        const parentDir = parentPath.length > 0 ? await getDirHandle(this.root, parentPath) : this.root;

        await parentDir.removeEntry(targetDirName, { recursive: true });
    } catch (e) {
        console.warn(`Failed to delete directory ${path}`, e);
    }
  }
}