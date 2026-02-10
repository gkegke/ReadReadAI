import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { importService } from '../services/ImportService';
import { exportService } from '../services/ExportService';
import { ProjectSchema, type Project, type Chunk } from '../types/schema'; // Added Chunk type
import { BaseRepository } from './BaseRepository';
import { ChunkRepository } from './ChunkRepository';
import { hashText } from '../lib/text-processor';
import { AudioGenerationService } from '../services/AudioGenerationService'; // Added Import

class ProjectRepositoryImpl extends BaseRepository<Project, typeof ProjectSchema> {
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

    // --- Facade Methods to fix UI/Hook Errors ---

    /**
     * Trigger immediate generation for a specific chunk.
     * Used by Play buttons and Demo initialization.
     */
    async generateChunkAudio(chunkId: number): Promise<void> {
        // We delegate to the service, bypassing the job queue for immediate user interaction
        return await AudioGenerationService.generate(chunkId);
    }

    /**
     * Used by the "DJ" engine to find the next track.
     */
    async getNextChunk(currentChunkId: number): Promise<Chunk | undefined> {
        return await ChunkRepository.getNext(currentChunkId);
    }

    /**
     * Used by the "DJ" engine to pre-load audio.
     * If audio is missing, it triggers generation.
     */
    async ensureChunkAudio(chunkId: number): Promise<void> {
        const chunk = await ChunkRepository.get(chunkId);
        if (!chunk) return;

        // If it's not generated and not currently processing, force it.
        if (chunk.status !== 'generated' && chunk.status !== 'processing') {
            await this.generateChunkAudio(chunkId);
        }
    }
}

export const ProjectRepository = new ProjectRepositoryImpl();