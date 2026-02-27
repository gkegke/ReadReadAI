import { db } from '../../../shared/db';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { importService } from '../../../shared/services/ImportService';
import { exportService } from '../../../shared/services/ExportService';
import { ProjectSchema, type Project, type Chunk } from '../../../shared/types/schema';
import { ChunkRepository } from '../../studio/api/ChunkRepository';
import { ChapterRepository } from './ChapterRepository';
import { hashText } from '../../../shared/lib/text-processor';
import { AudioGenerationService } from '../../tts/services/AudioGenerationService';
import { BaseRepository as SharedBaseRepository } from '../../../shared/api/BaseRepository';

class ProjectRepositoryImpl extends SharedBaseRepository<Project, typeof ProjectSchema> {
    constructor() {
        super(db.projects, ProjectSchema);
    }

    async createProject(name: string): Promise<number> {
        const now = new Date();
        let finalName = name.trim() || 'Untitled Project';
        
        let counter = 1;
        while (await db.projects.where('name').equals(finalName).count() > 0) {
            finalName = `${name.trim() || 'Untitled Project'} (${counter})`;
            counter++;
        }

        return await this.add({
            name: finalName, 
            createdAt: now, 
            updatedAt: now,
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });
    }

    async deleteProject(id: number): Promise<void> {
        await db.transaction('rw', [db.projects, db.chapters, db.chunks, db.jobs], async () => {
            await this.delete(id);
            await db.chapters.where('projectId').equals(id).delete();
            await db.chunks.where('projectId').equals(id).delete();
            await db.jobs.where('projectId').equals(id).delete();
        });
        if (useProjectStore.getState().activeProjectId === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    }

    /**
     * [EPIC 2] Non-Destructive Appends.
     * Imports no longer wipe the project. They append as a new chapter.
     */
    async importDocument(file: File, targetProjectId?: number): Promise<void> {
        const projectId = targetProjectId || useProjectStore.getState().activeProjectId;
        if (!projectId) throw new Error("No active project");
        
        const result = await importService.importFile(file, projectId);
        
        await db.transaction('rw', [db.projects, db.chapters, db.chunks, db.jobs], async () => {
            const chapterCount = await db.chapters.where('projectId').equals(projectId).count();
            const chunkCount = await db.chunks.where('projectId').equals(projectId).count();

            const chapterId = await ChapterRepository.createChapter(projectId, file.name || `Imported Document ${chapterCount + 1}`);

            const chunksWithChapter = result.chunks.map((c, i) => ({ 
                ...c, 
                chapterId,
                orderInProject: chunkCount + i, // Append globally
                cleanTextHash: hashText(c.textContent) 
            }));
            const newIds = await ChunkRepository.bulkAdd(chunksWithChapter);
            
            await this.update(projectId, { 
                sourceFileName: result.fileName, 
                updatedAt: new Date() 
            });
            
            await this.enqueueJobs(newIds, projectId, 10);
        });
    }

    /**
     * [EPIC 2] Non-Destructive Appends.
     */
    async importRawText(text: string, targetProjectId?: number): Promise<void> {
        const projectId = targetProjectId || useProjectStore.getState().activeProjectId;
        if (!projectId) return;

        const result = await importService.importText(text, projectId);
        
        await db.transaction('rw', [db.chapters, db.chunks, db.projects, db.jobs], async () => {
            const count = await db.chunks.where('projectId').equals(projectId).count();
            const chapterName = `Clip ${new Date().toLocaleTimeString()}`;
            const chapterId = await ChapterRepository.createChapter(projectId, chapterName);

            const chunksToAdd = result.chunks.map((c, i) => ({ 
                ...c, 
                chapterId, 
                orderInProject: count + i,
                cleanTextHash: hashText(c.textContent)
            }));
            const newIds = await ChunkRepository.bulkAdd(chunksToAdd);
            await this.enqueueJobs(newIds, projectId, 10);
            await this.update(projectId, { updatedAt: new Date() });
        });
    }

    private async enqueueJobs(chunkIds: number[], projectId: number, priority: number) {
        const jobs = chunkIds.map(id => ({
            chunkId: id,
            projectId: projectId,
            status: 'pending' as const,
            priority,
            createdAt: new Date()
        }));
        await db.jobs.bulkAdd(jobs);
    }

    async exportProjectAudio(projectId: number): Promise<void> {
        const result = await exportService.exportProjectAudio(projectId);
        if (!result) return alert("No audio generated.");
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
    }

    async generateChunkAudio(chunkId: number): Promise<void> {
        return await AudioGenerationService.generate(chunkId);
    }

    async getNextChunk(currentChunkId: number): Promise<Chunk | undefined> {
        return await ChunkRepository.getNext(currentChunkId);
    }

    async ensureChunkAudio(chunkId: number): Promise<void> {
        const chunk = await ChunkRepository.get(chunkId);
        if (!chunk) return;

        if (chunk.status !== 'generated' && chunk.status !== 'processing') {
            await this.generateChunkAudio(chunkId);
        }
    }
}

export const ProjectRepository = new ProjectRepositoryImpl();