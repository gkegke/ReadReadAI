import { Dexie, type EntityTable } from 'dexie';
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
 * ReadReadDB (Stable Edition)
 * [STABILITY: CRITICAL] Reverted to standard named import { Dexie }.
 * This is the canonical way to extend the class in Vite 6 + Vitest 1.6+.
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
    
    this.version(1).stores({
        projects: '++id, name, createdAt',
        chapters: '++id, projectId, [projectId+orderInProject]',
        chunks: '++id, projectId, chapterId, [projectId+orderInProject], [chapterId+orderInProject]',
        audioCache: 'hash, lastAccessedAt', 
        jobs: '++id, chunkId, projectId, status, priority, [status+priority]',
        logs: '++id, timestamp, severity, component'
    }).upgrade(async tx => {
        const chunksWithoutChapter = await tx.table('chunks').filter(c => !c.chapterId).toArray();
        if (chunksWithoutChapter.length > 0) {
            const projectIds = [...new Set(chunksWithoutChapter.map(c => c.projectId))];
            for (const pid of projectIds) {
                const chapterId = await tx.table('chapters').add({
                    projectId: pid,
                    name: "Recovered Chapter",
                    orderInProject: 0,
                    createdAt: new Date()
                });
                await tx.table('chunks').where('projectId').equals(pid).modify({ chapterId });
            }
        }
    });
 }
}

export const db = new ReadReadDB();

export const resetDatabase = async () => {
  await db.delete();
  await db.open();
};