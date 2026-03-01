export interface StorageService {
  /**
   * Initialize the storage (e.g., ensure root directories exist).
   */
  init(): Promise<void>;

  /**
   * Save a blob to the file system.
   * @param path - Relative path (e.g., 'audio/hash.wav')
   * @param blob - The data to store
   */
  saveFile(path: string, blob: Blob): Promise<void>;

  /**
   * Retrieve a file as a Blob.
   * @param path - Relative path
   */
  readFile(path: string): Promise<Blob>;

  /**
   * Delete a specific file.
   * @param path - Relative path
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Delete a directory and all its contents.
   * @param path - Relative path
   */
  deleteDirectory(path: string): Promise<void>;
  
  /**
   * List all files in a specific directory.
   * @param path - Relative path
   */
  listDirectory(path: string): Promise<string[]>;
  
  /**
   * Check if a file exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get the raw root handle (only available for OPFS).
   * Used for passing access to Web Workers.
   */
  getRootHandle(): Promise<FileSystemDirectoryHandle | null>;
}