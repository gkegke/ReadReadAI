import { db } from '../../../shared/db';
import { ChunkSchema, type Chunk } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { hashText } from '../../../shared/lib/text-processor';

class ChunkRepositoryImpl extends BaseRepository<Chunk, typeof ChunkSchema> {
    constructor() {
        super(db.chunks, ChunkSchema);
    }

    async reorder(projectId: number, chunkIds: number[]): Promise<void> {
        await db.transaction('rw', [db.chunks], async () => {
            const updates = chunkIds.map((id, index) => 
                db.chunks.update(id, { orderInProject: index, updatedAt: new Date() })
            );
            await Promise.all(updates);
        });
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

    /** 
     * [CRITICAL] Implements "Block Splitting" behavior (Enter key logic).
     * Splits one chunk into two and shifts all subsequent indices down.
     */
    async splitChunk(chunkId: number, cursorIndex: number): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk || cursorIndex < 0 || cursorIndex >= chunk.textContent.length) return;

        const firstPart = chunk.textContent.slice(0, cursorIndex).trim();
        const secondPart = chunk.textContent.slice(cursorIndex).trim();

        if (!firstPart || !secondPart) return; // Avoid creating empty ghost chunks

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            // 1. Shift all subsequent chunks down by 1 to make room
            await db.chunks
                .where('projectId').equals(chunk.projectId)
                .filter(c => c.orderInProject > chunk.orderInProject)
                .modify(c => c.orderInProject += 1);

            // 2. Update the original chunk (Left side of split)
            await this.updateText(chunkId, firstPart);

            // 3. Create the new chunk (Right side of split)
            const newChunkId = await this.add({
                projectId: chunk.projectId,
                chapterId: chunk.chapterId, // Inherit chapter context
                orderInProject: chunk.orderInProject + 1,
                textContent: secondPart,
                cleanTextHash: hashText(secondPart),
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // 4. Queue job for the new right-side chunk
            await this.ensureJob(newChunkId, chunk.projectId, 50);
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