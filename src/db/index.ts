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
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;

  constructor() {
    super('ReadReadAI_DB');
    
    // VERSION 1: Initial Schema
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
    });

    // VERSION 2: Added Audio Cache
    // This ensures existing users get the new table
    this.version(2).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        audioCache: 'hash'
    });
 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};