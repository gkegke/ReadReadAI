import { db } from '../../../shared/db';
import { ChunkSchema, type Chunk } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { hashText } from '../../../shared/lib/text-processor';

class ChunkRepositoryImpl extends BaseRepository<Chunk, typeof ChunkSchema> {
    constructor() {
        super(db.chunks, ChunkSchema);
    }

    async updateText(chunkId: number, newText: string): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk) return;

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await this.update(chunkId, {
                textContent: newText,
                cleanTextHash: hashText(newText),
                status: 'pending',
                updatedAt: new Date()
            });
            await this.ensureJob(chunkId, chunk.projectId, 50);
        });
    }

    async getNext(currentChunkId: number): Promise<Chunk | undefined> {
        const current = await this.get(currentChunkId);
        if (!current) return undefined;

        return db.chunks
            .where('[projectId+orderInProject]')
            .equals([current.projectId, current.orderInProject + 1])
            .first();
    }

    async setStatus(chunkId: number, status: Chunk['status']): Promise<void> {
        await this.update(chunkId, { status, updatedAt: new Date() });
    }

    private async ensureJob(chunkId: number, projectId: number, priority: number) {
        const existingJob = await db.jobs.where('chunkId').equals(chunkId).first();
        if (existingJob) {
            await db.jobs.update(existingJob.id!, { 
                status: 'pending', 
                priority: Math.max(existingJob.priority, priority) 
            });
        } else {
            await db.jobs.add({
                chunkId,
                projectId,
                status: 'pending',
                priority,
                createdAt: new Date()
            });
        }
    }
}

export const ChunkRepository = new ChunkRepositoryImpl();