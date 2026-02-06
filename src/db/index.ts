import Dexie, { type EntityTable } from 'dexie';
import type { Project, Chunk, Job } from '../types/schema';

export interface AudioCacheRecord {
  hash: string;
  path: string;       
  byteSize: number;   
  mimeType: string;
  createdAt: Date;
}

class ReadReadDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  audioCache!: EntityTable<AudioCacheRecord, 'hash'>;
  jobs!: EntityTable<Job, 'id'>; // NEW TABLE

  constructor() {
    super('ReadReadAI_DB');
    
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
    });

    this.version(2).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        audioCache: 'hash'
    });

    // VERSION 3: Add Jobs Table for Persistent Queue
    this.version(3).stores({
        projects: '++id, name, createdAt',
        chunks: '++id, projectId, [projectId+orderInProject]',
        audioCache: 'hash',
        jobs: '++id, chunkId, status, priority, [status+priority]'
    });
 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};