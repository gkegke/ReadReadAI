import type { StorageService } from './types';

export class OpfsStorageService implements StorageService {
  async init(): Promise<void> {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("OPFS (Origin Private File System) is not supported in this browser.");
    }
  }

  async getRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    return await navigator.storage.getDirectory();
  }

  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const root = await this.getRootHandle();
    if (!root) throw new Error("Storage not initialized");

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let currentDir = root;

    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create });
    }

    return await currentDir.getFileHandle(fileName, { create });
  }

  async saveFile(path: string, blob: Blob): Promise<void> {
    try {
      const fileHandle = await this.getFileHandle(path, true);
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      console.error(`[OpfsStorage] Failed to save ${path}:`, e);
      throw e;
    }
  }

  async readFile(path: string): Promise<Blob> {
    const fileHandle = await this.getFileHandle(path);
    return await fileHandle.getFile();
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(path: string): Promise<void> {
    const root = await this.getRootHandle();
    if (!root) return;

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let currentDir = root;

    try {
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part);
      }
      await currentDir.removeEntry(fileName);
    } catch (e) {
        console.warn(`[OpfsStorage] Delete failed for ${path}`, e);
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    const root = await this.getRootHandle();
    if (!root) return;

    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;

    const dirName = parts.pop()!;
    let parentDir = root;

    try {
        for (const part of parts) {
            parentDir = await parentDir.getDirectoryHandle(part);
        }
        await parentDir.removeEntry(dirName, { recursive: true });
    } catch (e) {
        console.warn(`[OpfsStorage] Could not delete directory ${path}`, e);
    }
  }

  async listDirectory(path: string): Promise<string[]> {
      const root = await this.getRootHandle();
      if (!root) return [];

      const parts = path.split('/').filter(Boolean);
      let currentDir = root;

      try {
          for (const part of parts) {
              currentDir = await currentDir.getDirectoryHandle(part);
          }

          const files: string[] = [];
          // @ts-ignore (TypeScript missing async iterators for FileSystem API)
          for await (const [name, handle] of currentDir.entries()) {
              if (handle.kind === 'file') files.push(name);
          }
          return files;
      } catch (e) {
          return [];
      }
  }
}
