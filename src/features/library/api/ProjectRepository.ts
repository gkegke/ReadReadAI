import { db } from '../../../shared/db';
import { ProjectSchema, type Project } from '../../../shared/types/schema';
import { ChunkRepository } from '../../studio/api/ChunkRepository';
import { AudioGenerationService } from '../../tts/services/AudioGenerationService';
import { BaseRepository } from '../../../shared/api/BaseRepository';
import { importService } from '../../../shared/services/ImportService';
import { exportService } from '../../../shared/services/ExportService';
import { hashText } from '../../../shared/lib/text-processor';

class ProjectRepositoryImpl extends BaseRepository<Project, typeof ProjectSchema> {
    constructor() {
        super(db.projects, ProjectSchema);
    }

    async createProject(name: string, skipScaffolding = false): Promise<number> {
        const now = new Date();
        const projectName = name.trim() || 'Untitled Project';

        return await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            const projectId = await this.add({
                name: projectName,
                createdAt: now,
                updatedAt: now,
                voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
            });

            if (skipScaffolding) return projectId;

            const headingText = "New Project";
            const paragraphText = "Start typing here, or use the Inspector to import a document.";

            const chunks = [
                {
                    projectId,
                    role: 'heading' as const,
                    orderInProject: 0,
                    textContent: headingText,
                    cleanTextHash: hashText(headingText, 'af_heart'),
                    status: 'pending' as const,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    projectId,
                    role: 'paragraph' as const,
                    orderInProject: 1,
                    textContent: paragraphText,
                    cleanTextHash: hashText(paragraphText, 'af_heart'),
                    status: 'pending' as const,
                    createdAt: now,
                    updatedAt: now
                }
            ];

            const chunkIds = await db.chunks.bulkAdd(chunks, { allKeys: true });

            const jobs = (chunkIds as number[]).map(id => ({
                chunkId: id,
                projectId,
                status: 'pending' as const,
                priority: 10,
                retryCount: 0,
                createdAt: now
            }));
            await db.jobs.bulkAdd(jobs);

            return projectId;
        });
    }

    async importDocument(file: File, projectId: number, afterOrderIndex?: number, onProgress?: (percent: number, text: string) => void) {
        return await importService.importFile(file, projectId, afterOrderIndex, onProgress);
    }

    async importRawText(text: string, projectId: number, afterOrderIndex?: number, onProgress?: (percent: number, text: string) => void) {
        return await importService.importText(text, projectId, afterOrderIndex, onProgress);
    }

    async exportProjectAudio(projectId: number, chapterIds?: string[]) {
        const result = await exportService.exportProjectAudio(projectId, chapterIds);
        if (result) {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    async generateChunkAudio(chunkId: number): Promise<void> {
        await db.chunks.update(chunkId, {
            status: 'pending',
            generatedFilePath: null,
            updatedAt: new Date()
        });

        return await AudioGenerationService.generate(chunkId);
    }

    async deleteProject(projectId: number): Promise<void> {
        await db.transaction('rw', [db.projects, db.chunks, db.jobs, db.audioCache, 'orphanedFiles'], async () => {
            const chunks = await db.chunks.where('projectId').equals(projectId).toArray();

            for (const chunk of chunks) {
                if (chunk.generatedFilePath) {
                    await db.table('orphanedFiles').add({ path: chunk.generatedFilePath, createdAt: new Date() });
                }
            }

            await db.chunks.where('projectId').equals(projectId).delete();
            await db.jobs.where('projectId').equals(projectId).delete();
            await db.projects.delete(projectId);
        });
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
