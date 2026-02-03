import Dexie, { type EntityTable } from 'dexie';
import type { Project, Chunk } from '../types/schema';

// New interface for the audio cache table (Metadata only)
export interface AudioCacheRecord {
  hash: string;
  path: string;       // Path in OPFS (e.g., 'audio/xyz.wav')
  byteSize: number;   // Size in bytes
  mimeType: string;
  createdAt: Date;
}

// Database version definition
class ReadReadDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  // Updated table definition
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;

  constructor() {
    super('ReadReadAI_DB');
    
    this.version(2).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        audioCache: 'hash' // Key remains hash, but content changes
    }).upgrade(tx => {
        // Clear the table because the data format is changing from {blob} to {path, size}
        // and we haven't moved the blobs to OPFS in this migration script.
        return tx.table('audioCache').clear();
    });
  }
}

export const db = new ReadReadDB();

// Helper to reset DB (Useful for development/debugging)
export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};