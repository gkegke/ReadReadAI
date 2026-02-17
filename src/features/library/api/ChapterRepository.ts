import { db } from '../../../shared/db';
import { ChapterSchema, type Chapter } from '../../../shared/types/schema';
import { BaseRepository } from '../../../shared/api/BaseRepository';

/**
 * ChapterRepository
 * Manages the "Chapters" or "Sections" within a project.
 */
class ChapterRepositoryImpl extends BaseRepository<Chapter, typeof ChapterSchema> {
    constructor() {
        super(db.chapters, ChapterSchema);
    }

    async createChapter(projectId: number, name: string): Promise<number> {
        const count = await db.chapters.where('projectId').equals(projectId).count();
        return await this.add({
            projectId,
            name,
            orderInProject: count,
            createdAt: new Date()
        });
    }

    async getForProject(projectId: number): Promise<Chapter[]> {
        return await db.chapters
            .where('projectId')
            .equals(projectId)
            .sortBy('orderInProject');
    }

    async deleteChapter(id: number): Promise<void> {
        await db.transaction('rw', [db.chapters, db.chunks, db.jobs], async () => {
            await this.delete(id);
            // Cascade delete or re-orphan chunks? For now, we delete chunks in this chapter.
            await db.chunks.where('chapterId').equals(id).delete();
        });
    }
}

export const ChapterRepository = new ChapterRepositoryImpl();