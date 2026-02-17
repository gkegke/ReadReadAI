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

class ReadReadDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>; // [NEW]
  chunks!: EntityTable<Chunk, 'id'>;
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;
  jobs!: EntityTable<Job, 'id'>;
  logs!: EntityTable<LogEntry, 'id'>;

  constructor() {
    super('ReadReadAI_DB');
    
    // [BUMP] Version 2: Added Chapters and related indexing for hierarchy
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chapters: '++id, projectId, [projectId+orderInProject]',
        // [INDEX] Added chapterId and composite index for scoped timeline rendering
        chunks: '++id, projectId, chapterId, [projectId+orderInProject], [chapterId+orderInProject]',
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