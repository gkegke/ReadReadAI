import type { StorageService } from './types';

export class MemoryStorageService implements StorageService {
  private files = new Map<string, Blob>();

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async getRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    return null;
  }

  async saveFile(path: string, blob: Blob): Promise<void> {
    this.files.set(path, blob);
  }

  async readFile(path: string): Promise<Blob> {
    const blob = this.files.get(path);
    if (!blob) {
      throw new Error(`[MemoryStorage] File not found: ${path}`);
    }
    return blob;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async deleteDirectory(path: string): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(path)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => this.files.delete(k));
  }

  // [EPIC 1] List implementation for memory mapping
  async listDirectory(path: string): Promise<string[]> {
      const files: string[] = [];
      const prefix = path.endsWith('/') ? path : `${path}/`;
      
      for (const key of this.files.keys()) {
          if (key.startsWith(prefix)) {
              files.push(key.replace(prefix, ''));
          }
      }
      return files;
  }
}