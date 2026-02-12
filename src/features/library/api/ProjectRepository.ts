import { db } from '../../../shared/db';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { importService } from '../../../shared/services/ImportService';
import { exportService } from '../../../shared/services/ExportService';
import { ProjectSchema, type Project, type Chunk } from '../../../shared/types/schema';
import { ChunkRepository } from '../../studio/api/ChunkRepository';
import { hashText } from '../../../shared/lib/text-processor';
import { AudioGenerationService } from '../../tts/services/AudioGenerationService';
import { BaseRepository as SharedBaseRepository } from '../../../shared/api/BaseRepository'; // FIXED PATH

class ProjectRepositoryImpl extends SharedBaseRepository<Project, typeof ProjectSchema> {
    constructor() {
        super(db.projects, ProjectSchema);
    }

    async createProject(name: string): Promise<number> {
        const now = new Date();
        return await this.add({
            name, 
            createdAt: now, 
            updatedAt: now,
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });
    }

    async deleteProject(id: number): Promise<void> {
        await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            await this.delete(id);
            await db.chunks.where('projectId').equals(id).delete();
            await db.jobs.where('projectId').equals(id).delete();
        });
        if (useProjectStore.getState().activeProjectId === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    }

    async importDocument(file: File): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) throw new Error("No active project");
        
        const result = await importService.importFile(file, activeProjectId);
        
        await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            await db.chunks.where('projectId').equals(activeProjectId).delete();
            await db.jobs.where('projectId').equals(activeProjectId).delete();
            
            const newIds = await ChunkRepository.bulkAdd(result.chunks);
            await this.update(activeProjectId, { 
                sourceFileName: result.fileName, 
                updatedAt: new Date() 
            });
            
            await this.enqueueJobs(newIds, activeProjectId, 10);
        });
    }

    async importRawText(text: string): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;

        const result = await importService.importText(text, activeProjectId);
        const count = await db.chunks.where('projectId').equals(activeProjectId).count();
        
        await db.transaction('rw', [db.chunks, db.projects, db.jobs], async () => {
            const chunksToAdd = result.chunks.map((c, i) => ({ 
                ...c, 
                orderInProject: count + i,
                cleanTextHash: hashText(c.textContent)
            }));
            const newIds = await ChunkRepository.bulkAdd(chunksToAdd);
            await this.enqueueJobs(newIds, activeProjectId, 10);
            await this.update(activeProjectId, { updatedAt: new Date() });
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