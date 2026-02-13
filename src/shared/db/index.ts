import Dexie, { type EntityTable } from 'dexie';
import type { Project, Chunk, Job, LogEntry } from '../types/schema';

export interface AudioCacheRecord {
  hash: string;
  path: string;       
  byteSize: number;   
  mimeType: string;
  createdAt: Date;
  lastAccessedAt: Date; // [CRITICAL] Added for LRU Eviction Policy
}

class ReadReadDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;
  jobs!: EntityTable<Job, 'id'>;
  logs!: EntityTable<LogEntry, 'id'>;

  constructor() {
    super('ReadReadAI_DB');
    
    this.version(1).stores({ // [BUMP] Version 2 for LRU index
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        // [OPTIMIZATION] Index lastAccessedAt for fast LRU queries
        audioCache: 'hash, lastAccessedAt', 
        jobs: '++id, chunkId, status, priority, [status+priority]',
        logs: '++id, timestamp, severity, component'
    });
 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};