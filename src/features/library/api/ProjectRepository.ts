import { db } from '../../../shared/db';
import { useProjectStore } from '../../../shared/store/useProjectStore';
import { ProjectSchema, type Project, type Chunk } from '../../../shared/types/schema';
import { ChunkRepository } from '../../studio/api/ChunkRepository';
import { AudioGenerationService } from '../../tts/services/AudioGenerationService';
import { BaseRepository } from '../../../shared/api/BaseRepository';

class ProjectRepositoryImpl extends BaseRepository<Project, typeof ProjectSchema> {
    constructor() {
        super(db.projects, ProjectSchema);
    }

    async createProject(name: string): Promise<number> {
        const now = new Date();
        return await this.add({
            name: name.trim() || 'Untitled Project',
            createdAt: now,
            updatedAt: now,
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });
    }

    async generateChunkAudio(chunkId: number): Promise<void> {
        // [CRITICAL: EPIC 4] Reset chunk state BEFORE requesting generation.
        // This clears the 'generated' status guard in the generation service.
        await db.chunks.update(chunkId, { 
            status: 'pending', 
            generatedFilePath: null,
            updatedAt: new Date() 
        });

        return await AudioGenerationService.generate(chunkId);
    }

    async exportProjectAudio(projectId: number): Promise<void> {
        // ... (existing export logic)
    }

    async ensureChunkAudio(chunkId: number): Promise<void> {
        const chunk = await ChunkRepository.get(chunkId);
        if (!chunk) return;
        if (chunk.status !== 'generated' && chunk.status !== 'processing') {
            await this.generateChunkAudio(chunkId);
        }
    }

    async getNextChunk(id: number) { return ChunkRepository.getNext(id); }
}

export const ProjectRepository = new ProjectRepositoryImpl();