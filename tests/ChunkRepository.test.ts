import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/shared/db';
import { ChunkRepository } from '../src/features/studio/api/ChunkRepository';
import { ProjectRepository } from '../src/features/library/api/ProjectRepository';

describe('ChunkRepository', () => {
    let testProjectId: number;

    beforeEach(async () => {
        // Reset and seed a real project using the actual repository logic
        testProjectId = await ProjectRepository.createProject('Test Project', true);
    });

    it('should perfectly normalize chunk orders after deletion', async () => {
        // Manually inject 3 paragraphs
        const now = new Date();
        const chunkData = [
            { projectId: testProjectId, orderInProject: 0, textContent: 'A', cleanTextHash: '1', status: 'pending' as const, createdAt: now, updatedAt: now },
            { projectId: testProjectId, orderInProject: 1, textContent: 'B', cleanTextHash: '2', status: 'pending' as const, createdAt: now, updatedAt: now },
            { projectId: testProjectId, orderInProject: 2, textContent: 'C', cleanTextHash: '3', status: 'pending' as const, createdAt: now, updatedAt: now }
        ];

        const ids = await db.chunks.bulkAdd(chunkData, { allKeys: true }) as number[];

        // Delete the middle chunk ('B')
        await ChunkRepository.deleteChunks(testProjectId, [ids[1]]);

        const remaining = await db.chunks
            .where('projectId')
            .equals(testProjectId)
            .sortBy('orderInProject');

        expect(remaining.length).toBe(2);
        expect(remaining[0].textContent).toBe('A');
        expect(remaining[0].orderInProject).toBe(0);
        expect(remaining[1].textContent).toBe('C');
        expect(remaining[1].orderInProject).toBe(1); // Crucial: C shifted from 2 -> 1
    });

    it('should merge chunk with the next sequential chunk correctly', async () => {
        const now = new Date();
        const ids = await db.chunks.bulkAdd([
            { projectId: testProjectId, orderInProject: 0, textContent: 'Hello', cleanTextHash: '1', status: 'pending' as const, createdAt: now, updatedAt: now },
            { projectId: testProjectId, orderInProject: 1, textContent: 'World', cleanTextHash: '2', status: 'pending' as const, createdAt: now, updatedAt: now }
        ], { allKeys: true }) as number[];

        await ChunkRepository.mergeWithNext(ids[0]);

        const merged = await db.chunks.get(ids[0]);
        const deleted = await db.chunks.get(ids[1]);

        expect(merged?.textContent).toBe('Hello World');
        expect(deleted).toBeUndefined();

        // Ensure the order was maintained/normalized
        expect(merged?.orderInProject).toBe(0);
    });

    it('should split a chunk into two at a specific cursor position', async () => {
        const now = new Date();
        const id = await db.chunks.add({
            projectId: testProjectId,
            orderInProject: 0,
            textContent: 'SplitThis',
            cleanTextHash: 'orig',
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now
        }) as number;

        // Split at index 5 ('Split' | 'This')
        await ChunkRepository.splitChunk(id, 5);

        const chunks = await db.chunks.where('projectId').equals(testProjectId).sortBy('orderInProject');

        expect(chunks).toHaveLength(2);
        expect(chunks[0].textContent).toBe('Split');
        expect(chunks[1].textContent).toBe('This');
        expect(chunks[1].orderInProject).toBe(1);
    });
});
