import { db } from '../../../shared/db';
import { ChunkSchema, type Chunk } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { hashText, chunkText } from '../../../shared/lib/text-processor';
import { StorageQuotaService } from '../../../shared/services/storage/StorageQuotaService';
import { logger } from '../../../shared/services/Logger';
import { audioPlaybackService } from '../services/AudioPlaybackService';

class ChunkRepositoryImpl extends BaseRepository<Chunk, typeof ChunkSchema> {
    constructor() {
        super(db.chunks, ChunkSchema);
    }

    async getNext(currentChunkId: number): Promise<Chunk | undefined> {
        const current = await this.get(currentChunkId);
        if (!current) return undefined;

        return await db.chunks
            .where('[projectId+orderInProject]')
            .equals([current.projectId, current.orderInProject + 1])
            .first();
    }

    async swapChunks(idA: number, idB: number): Promise<void> {
        await db.transaction('rw', db.chunks, async () => {
            const [chunkA, chunkB] = await Promise.all([
                this.get(idA),
                this.get(idB)
            ]);

            if (!chunkA || !chunkB) return;

            const orderA = chunkA.orderInProject;
            const orderB = chunkB.orderInProject;

            await Promise.all([
                db.chunks.update(idA, { orderInProject: orderB, updatedAt: new Date() }),
                db.chunks.update(idB, { orderInProject: orderA, updatedAt: new Date() })
            ]);
        });
    }

    async bulkRegenerate(projectId: number, chunkIds: number[]): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            const chunks = await db.chunks.where('id').anyOf(chunkIds).toArray();
            
            for (const chunk of chunks) {
                if (chunk.generatedFilePath) {
                    await db.table('orphanedFiles').add({ path: chunk.generatedFilePath, createdAt: new Date() });
                    await db.audioCache.delete(chunk.cleanTextHash);
                }

                await db.chunks.update(chunk.id!, {
                    status: 'pending',
                    generatedFilePath: null,
                    updatedAt: new Date()
                });

                await this.ensureJob(chunk.id!, projectId, 10);
            }
        });
        StorageQuotaService.processOrphanQueue();
    }

    /**
     * [ISSUE 2 FIX] Complete Audio Invalidation Routine
     * Now also clears the playback service's internal buffer cache.
     */
    async clearProjectAudio(projectId: number): Promise<void> {
        // Purge memory cache immediately
        audioPlaybackService.clearBufferCache();

        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            const chunks = await db.chunks.where('projectId').equals(projectId).toArray();
            const orphanTable = db.table('orphanedFiles');

            for (const chunk of chunks) {
                if (chunk.generatedFilePath) {
                    await orphanTable.add({ path: chunk.generatedFilePath, createdAt: new Date() });
                    await db.audioCache.delete(chunk.cleanTextHash);
                }
                
                await db.chunks.update(chunk.id!, {
                    status: 'pending',
                    generatedFilePath: null,
                    updatedAt: new Date()
                });
            }
            
            await db.jobs.where('projectId').equals(projectId).delete();
        });
        
        StorageQuotaService.processOrphanQueue();
        logger.info('ChunkRepository', `Cleared all audio and memory buffers for project ${projectId}`);
    }

    async queueMissing(projectId: number, fromOrderIndex: number = 0): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const chunks = await db.chunks
                .where('projectId').equals(projectId)
                .filter(c => c.orderInProject >= fromOrderIndex && c.status !== 'generated' && c.status !== 'processing')
                .toArray();

            for (const chunk of chunks) {
                await this.ensureJob(chunk.id!, projectId, 20);
                await db.chunks.update(chunk.id!, { status: 'pending', updatedAt: new Date() });
            }
        });
    }

    async insertBlock(text: string, projectId: number, afterOrderIndex: number, role: 'heading' | 'paragraph' = 'paragraph'): Promise<void> {
        const subChunks = await chunkText(text);
        if (subChunks.length === 0) return;

        // Get project to include voice in initial hash
        const project = await db.projects.get(projectId);
        const voiceId = project?.voiceSettings?.voiceId;

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks
                .where('projectId').equals(projectId)
                .filter(c => c.orderInProject > afterOrderIndex)
                .modify(c => c.orderInProject += subChunks.length);

            let currentOrder = afterOrderIndex + 1;
            const now = new Date();

            for (const content of subChunks) {
                const newId = await db.chunks.add({
                    projectId,
                    role: currentOrder === afterOrderIndex + 1 ? role : 'paragraph',
                    orderInProject: currentOrder++,
                    textContent: content,
                    cleanTextHash: hashText(content, voiceId), // [ISSUE 2 FIX]
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now
                });

                await this.ensureJob(newId, projectId, 100); 
            }
        });
    }

    async updateText(chunkId: number, newText: string): Promise<void> {
        const chunk = await this.get(chunkId);
        if (!chunk) return;

        const project = await db.projects.get(chunk.projectId);
        const voiceId = project?.voiceSettings?.voiceId;

        await db.transaction('rw', [db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            if (chunk.generatedFilePath) {
                await db.table('orphanedFiles').add({ path: chunk.generatedFilePath, createdAt: new Date() });
                await db.audioCache.delete(chunk.cleanTextHash);
            }

            await db.chunks.update(chunkId, {
                textContent: newText,
                cleanTextHash: hashText(newText, voiceId), // [ISSUE 2 FIX]
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
        if (!chunk || cursorIndex <= 0 || cursorIndex >= chunk.textContent.length) return;

        const project = await db.projects.get(chunk.projectId);
        const voiceId = project?.voiceSettings?.voiceId;

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
                cleanTextHash: hashText(firstPart, voiceId), // [ISSUE 2 FIX]
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });
            await this.ensureJob(chunkId, chunk.projectId, 80);

            const newChunkId = await db.chunks.add({
                projectId: chunk.projectId,
                role: 'paragraph', 
                orderInProject: chunk.orderInProject + 1,
                textContent: secondPart,
                cleanTextHash: hashText(secondPart, voiceId), // [ISSUE 2 FIX]
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await this.ensureJob(newChunkId, chunk.projectId, 80);
        });
        StorageQuotaService.processOrphanQueue();
    }

    async mergeWithNext(chunkId: number): Promise<void> {
        const chunkA = await this.get(chunkId);
        if (!chunkA) return;

        const project = await db.projects.get(chunkA.projectId);
        const voiceId = project?.voiceSettings?.voiceId;

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
                cleanTextHash: hashText(newText, voiceId), // [ISSUE 2 FIX]
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });

            await db.chunks.delete(chunkB.id!);
            await db.jobs.where('chunkId').equals(chunkB.id!).delete();

            await db.chunks
                .where('projectId').equals(chunkA.projectId)
                .filter(c => c.orderInProject > chunkA.orderInProject + 1)
                .modify(c => c.orderInProject -= 1);

            await this.ensureJob(chunkA.id!, chunkA.projectId, 50);
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