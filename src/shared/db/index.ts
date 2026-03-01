import { Dexie, type EntityTable } from 'dexie';
import type { Project, Chunk, Job, LogEntry, OrphanedFile } from '../types/schema';

export interface AudioCacheRecord {
  hash: string;
  path: string;       
  byteSize: number;   
  mimeType: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

class ReadReadDB extends Dexie {
  // Property declarations for TypeScript
  projects!: EntityTable<Project, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;
  jobs!: EntityTable<Job, 'id'>;
  logs!: EntityTable<LogEntry, 'id'>;
  orphanedFiles!: EntityTable<OrphanedFile, 'id'>;

  constructor() {
    super('ReadReadAI_DB');
    
    // [CRITICAL: VERSIONING] Explicitly maintain version history. 
    // This ensures that browsers with V1 databases migrate to V2 correctly.
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        audioCache: 'hash, lastAccessedAt', 
        jobs: '++id, chunkId, projectId, status, priority, [status+priority]',
        logs: '++id, timestamp, severity, component',
        orphanedFiles: '++id, path, createdAt'
    });

 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};