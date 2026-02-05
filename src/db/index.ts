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
    
    // Bumped to version 3 for Schema additions (voiceOverride)
    // Dexie handles new optional fields gracefully without a formal upgrade callback 
    // unless we were adding indices.
    this.version(1).stores({
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