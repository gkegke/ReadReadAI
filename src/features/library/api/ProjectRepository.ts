import { db } from '../../../shared/db';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { importService } from '../../../shared/services/ImportService';
import { exportService } from '../../../shared/services/ExportService';
import { ProjectSchema, type Project, type Chunk } from '../../../shared/types/schema';
import { ChunkRepository } from '../../studio/api/ChunkRepository';
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
        await db.transaction('rw', [db.projects, db.chunks, db.jobs, db.audioCache], async () => {
            await this.delete(id);
            await db.chunks.where('projectId').equals(id).delete();
            await db.jobs.where('projectId').equals(id).delete();
        });

        if (useProjectStore.getState().activeProjectId === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    }

    async importDocument(file: File, targetProjectId?: number, afterOrderIndex?: number): Promise<void> {
        const projectId = targetProjectId || useProjectStore.getState().activeProjectId;
        if (!projectId) throw new Error("No active project");
        
        const result = await importService.importFile(file, projectId, afterOrderIndex);
        
        await this.update(projectId, { 
            sourceFileName: result.fileName, 
            updatedAt: new Date() 
        });
    }

    async importRawText(text: string, targetProjectId?: number, afterOrderIndex?: number): Promise<void> {
        const projectId = targetProjectId || useProjectStore.getState().activeProjectId;
        if (!projectId) return;

        await importService.importText(text, projectId, afterOrderIndex);
        await this.update(projectId, { updatedAt: new Date() });
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