import { db } from '../../../shared/db';
import { ChunkSchema, type Chunk } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { hashText } from '../../../shared/lib/text-processor';

class ChunkRepositoryImpl extends BaseRepository<Chunk, typeof ChunkSchema> {
    constructor() {
        super(db.chunks, ChunkSchema);
    }

    private async normalizeProjectOrders(projectId: number): Promise<void> {
        const chunks = await db.chunks.where('projectId').equals(projectId).sortBy('orderInProject');
        const updates = [];
        
        for (let i = 0; i < chunks.length; i++) {
            if (chunks[i].orderInProject !== i) {
                updates.push(db.chunks.update(chunks[i].id!, { orderInProject: i }));
            }
        }
        
        if (updates.length > 0) {
            await Promise.all(updates);
        }
    }

    async deleteChunks(projectId: number, chunkIds: number[]): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks.bulkDelete(chunkIds);
            await db.jobs.where('chunkId').anyOf(chunkIds).delete();
            await this.normalizeProjectOrders(projectId);
        });
    }

    async bulkRegenerate(projectId: number, chunkIds: number[]): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const chunks = await db.chunks.where('id').anyOf(chunkIds).toArray();
            const jobs = [];
            
            for (const chunk of chunks) {
                await db.chunks.update(chunk.id!, { status: 'pending' });
                jobs.push({ 
                    chunkId: chunk.id!, 
                    projectId, 
                    status: 'pending' as const, 
                    priority: 50, 
                    createdAt: new Date() 
                });
            }
            
            await db.jobs.where('chunkId').anyOf(chunkIds).delete();
            await db.jobs.bulkAdd(jobs);
        });
    }

    async mergeWithNext(chunkId: number): Promise<void> {
        const chunkA = await this.get(chunkId);
        if (!chunkA) return;

        const chunkB = await db.chunks
            .where('[projectId+orderInProject]')
            .equals([chunkA.projectId, chunkA.orderInProject + 1])
            .first();

        if (!chunkB) return;

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const newText = `${chunkA.textContent} ${chunkB.textContent}`.trim();
            
            await this.update(chunkA.id!, {
                textContent: newText,
                cleanTextHash: hashText(newText),
                status: 'pending',
                updatedAt: new Date()
            });

            await db.chunks.delete(chunkB.id!);
            await db.jobs.where('chunkId').equals(chunkB.id!).delete();

            await this.normalizeProjectOrders(chunkA.projectId);
            await this.ensureJob(chunkA.id!, chunkA.projectId, 50);
        });
    }

    async insertBlock(text: string, projectId: number, afterOrderIndex: number, role: 'heading' | 'paragraph' = 'paragraph'): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks
                .where('projectId').equals(projectId)
                .filter(c => c.orderInProject > afterOrderIndex)
                .modify(c => c.orderInProject += 1);

            const newChunkId = await this.add({
                projectId,
                role,
                orderInProject: afterOrderIndex + 1,
                textContent: text,
                cleanTextHash: hashText(text),
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await this.ensureJob(newChunkId, projectId, 50);
        });
    }

    async swapChunks(chunkId1: number, chunkId2: number): Promise<void> {
        await db.transaction('rw', [db.chunks], async () => {
            const c1 = await this.get(chunkId1);
            const c2 = await this.get(chunkId2);
            if (!c1 || !c2) return;
            
            await this.update(chunkId1, { orderInProject: c2.orderInProject });
            await this.update(chunkId2, { orderInProject: c1.orderInProject });
        });
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

    async splitChunk(chunkId: number, cursorIndex: number): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk || cursorIndex < 0 || cursorIndex >= chunk.textContent.length) return;

        const firstPart = chunk.textContent.slice(0, cursorIndex).trim();
        const secondPart = chunk.textContent.slice(cursorIndex).trim();

        if (!firstPart || !secondPart) return;

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks
                .where('projectId').equals(chunk.projectId)
                .filter(c => c.orderInProject > chunk.orderInProject)
                .modify(c => c.orderInProject += 1);

            await this.updateText(chunkId, firstPart);

            const newChunkId = await this.add({
                projectId: chunk.projectId,
                role: 'paragraph', // Splitting a chunk always results in a paragraph continuation
                orderInProject: chunk.orderInProject + 1,
                textContent: secondPart,
                cleanTextHash: hashText(secondPart),
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

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