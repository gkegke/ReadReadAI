import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDatabase } from '../src/shared/db';
import { ChunkRepository } from '../src/features/studio/api/ChunkRepository';
import { hashText } from '../src/shared/lib/text-processor';

describe('ChunkRepository', () => {
    beforeEach(async () => {
        await resetDatabase();
        // Seed base project
        await db.projects.add({ name: 'Test Project', createdAt: new Date(), updatedAt: new Date(), voiceSettings: { voiceId: 'af_heart', speed: 1.0 } });
        await db.chapters.add({ projectId: 1, name: 'Chapter 1', orderInProject: 0, createdAt: new Date() });
    });

    it('should perfectly normalize chunk orders after deletion', async () => {
        // Create 3 chunks
        const ids = await ChunkRepository.bulkAdd([
            { projectId: 1, chapterId: 1, orderInProject: 0, textContent: 'A', cleanTextHash: '1', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
            { projectId: 1, chapterId: 1, orderInProject: 1, textContent: 'B', cleanTextHash: '2', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
            { projectId: 1, chapterId: 1, orderInProject: 2, textContent: 'C', cleanTextHash: '3', status: 'pending', createdAt: new Date(), updatedAt: new Date() }
        ]);

        // Delete the middle chunk
        await ChunkRepository.deleteChunks(1, [ids[1]]);

        const remaining = await db.chunks.where('projectId').equals(1).sortBy('orderInProject');
        
        expect(remaining.length).toBe(2);
        expect(remaining[0].textContent).toBe('A');
        expect(remaining[0].orderInProject).toBe(0); // Kept position
        expect(remaining[1].textContent).toBe('C');
        expect(remaining[1].orderInProject).toBe(1); // Shifted down perfectly
    });

    it('should merge chunk with the next sequential chunk', async () => {
        const ids = await ChunkRepository.bulkAdd([
            { projectId: 1, chapterId: 1, orderInProject: 0, textContent: 'Hello', cleanTextHash: '1', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
            { projectId: 1, chapterId: 1, orderInProject: 1, textContent: 'World', cleanTextHash: '2', status: 'pending', createdAt: new Date(), updatedAt: new Date() }
        ]);

        await ChunkRepository.mergeWithNext(ids[0]);

        const merged = await db.chunks.get(ids[0]);
        const deleted = await db.chunks.get(ids[1]);

        expect(merged?.textContent).toBe('Hello World');
        expect(deleted).toBeUndefined();
    });
});