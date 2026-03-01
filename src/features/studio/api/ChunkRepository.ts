import { db } from '../../../shared/db';
import { ChunkSchema, type Chunk } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { hashText } from '../../../shared/lib/text-processor';
import { StorageQuotaService } from '../../../shared/services/storage/StorageQuotaService';

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
        const chunksToDelete = await db.chunks.where('id').anyOf(chunkIds).toArray();
        const orphans = chunksToDelete.map(c => c.generatedFilePath).filter(Boolean) as string[];
        const hashes = chunksToDelete.map(c => c.cleanTextHash).filter(Boolean) as string[];

        // [EPIC 4] Atomic OPFS Invalidation
        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            if (orphans.length > 0) {
                const orphanTable = db.table('orphanedFiles');
                await orphanTable.bulkAdd(orphans.map(path => ({ path, createdAt: new Date() })));
            }
            if (hashes.length > 0) await db.audioCache.bulkDelete(hashes);
            
            await db.chunks.bulkDelete(chunkIds);
            await db.jobs.where('chunkId').anyOf(chunkIds).delete();
            await this.normalizeProjectOrders(projectId);
        });

        StorageQuotaService.processOrphanQueue();
    }

    // ... bulkRegenerate, swapChunks, reorder unchanged ...

    async mergeWithNext(chunkId: number): Promise<void> {
        const chunkA = await this.get(chunkId);
        if (!chunkA) return;

        const chunkB = await db.chunks
            .where('[projectId+orderInProject]')
            .equals([chunkA.projectId, chunkA.orderInProject + 1])
            .first();

        if (!chunkB) return;

        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            const orphanTable = db.table('orphanedFiles');
            if (chunkA.generatedFilePath) {
                await orphanTable.add({ path: chunkA.generatedFilePath, createdAt: new Date() });
                await db.audioCache.delete(chunkA.cleanTextHash);
            }
            if (chunkB.generatedFilePath) {
                await orphanTable.add({ path: chunkB.generatedFilePath, createdAt: new Date() });
                await db.audioCache.delete(chunkB.cleanTextHash);
            }

            const newText = `${chunkA.textContent} ${chunkB.textContent}`.trim();
            
            await db.chunks.update(chunkA.id!, {
                textContent: newText,
                cleanTextHash: hashText(newText),
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });

            await db.chunks.delete(chunkB.id!);
            await db.jobs.where('chunkId').equals(chunkB.id!).delete();

            await this.normalizeProjectOrders(chunkA.projectId);
            await this.ensureJob(chunkA.id!, chunkA.projectId, 50);
        });
        StorageQuotaService.processOrphanQueue();
    }

    async updateText(chunkId: number, newText: string): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk) return;

        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            if (chunk.generatedFilePath) {
                await db.table('orphanedFiles').add({ path: chunk.generatedFilePath, createdAt: new Date() });
                await db.audioCache.delete(chunk.cleanTextHash);
            }

            await db.chunks.update(chunkId, {
                textContent: newText,
                cleanTextHash: hashText(newText),
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });
            await this.ensureJob(chunkId, chunk.projectId, 50);
        });
        StorageQuotaService.processOrphanQueue();
    }

    async splitChunk(chunkId: number, cursorIndex: number): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk || cursorIndex < 0 || cursorIndex >= chunk.textContent.length) return;

        const firstPart = chunk.textContent.slice(0, cursorIndex).trim();
        const secondPart = chunk.textContent.slice(cursorIndex).trim();

        if (!firstPart || !secondPart) return;

        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            if (chunk.generatedFilePath) {
                await db.table('orphanedFiles').add({ path: chunk.generatedFilePath, createdAt: new Date() });
                await db.audioCache.delete(chunk.cleanTextHash);
            }

            await db.chunks
                .where('projectId').equals(chunk.projectId)
                .filter(c => c.orderInProject > chunk.orderInProject)
                .modify(c => c.orderInProject += 1);

            await db.chunks.update(chunkId, {
                textContent: firstPart,
                cleanTextHash: hashText(firstPart),
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });
            await this.ensureJob(chunkId, chunk.projectId, 50);

            const newChunkId = await db.chunks.add({
                projectId: chunk.projectId,
                role: 'paragraph', 
                orderInProject: chunk.orderInProject + 1,
                textContent: secondPart,
                cleanTextHash: hashText(secondPart),
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await this.ensureJob(newChunkId, chunk.projectId, 50);
        });
        StorageQuotaService.processOrphanQueue();
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