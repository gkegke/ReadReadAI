import Dexie, { type EntityTable } from 'dexie';
import type { Project, Chunk, Job, LogEntry, Chapter } from '../types/schema';

export interface AudioCacheRecord {
  hash: string;
  path: string;       
  byteSize: number;   
  mimeType: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * ReadReadDB (V2.1)
 * [CRITICAL: SCHEMA] Added projectId index to jobs table to support cascade deletions.
 */
class ReadReadDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;
  jobs!: EntityTable<Job, 'id'>;
  logs!: EntityTable<LogEntry, 'id'>;

  constructor() {
    super('ReadReadAI_DB');
    
    // [BUMP] Version 2: Supporting hierarchical navigation and job indexing
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chapters: '++id, projectId, [projectId+orderInProject]',
        chunks: '++id, projectId, chapterId, [projectId+orderInProject], [chapterId+orderInProject]',
        audioCache: 'hash, lastAccessedAt', 
        // [FIX] Added projectId to the index string below
        jobs: '++id, chunkId, projectId, status, priority, [status+priority]',
        logs: '++id, timestamp, severity, component'
    });
 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};