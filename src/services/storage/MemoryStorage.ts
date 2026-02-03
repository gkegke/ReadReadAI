import type { StorageService } from './types';

/**
 * Fallback storage implementation for environments where OPFS is unavailable
 * (e.g., Firefox Private Browsing).
 */
export class MemoryStorageService implements StorageService {
  private files = new Map<string, Blob>();

  async init(): Promise<void> {
    return Promise.resolve();
  }

  // Memory storage cannot provide a FileSystemHandle for the worker
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
}