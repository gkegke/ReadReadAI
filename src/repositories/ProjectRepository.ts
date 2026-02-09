import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { importService } from '../services/ImportService';
import { chunkText, hashText } from '../lib/text-processor';
import { exportService } from '../services/ExportService';
import { type Chunk } from '../types/schema';

/**
 * ProjectRepository
 * 
 * Central Domain Layer for ReadReadAI.
 * Encapsulates all Dexie/DB interactions.
 */
export const ProjectRepository = {
    // --- Project Management ---

    async createProject(name: string): Promise<number> {
        const now = new Date();
        const id = await db.projects.add({
            name, 
            createdAt: now, 
            updatedAt: now,
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });
        useProjectStore.getState().setActiveProject(id);
        return id;
    },

    async deleteProject(id: number): Promise<void> {
        await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            await db.projects.delete(id);
            await db.chunks.where('projectId').equals(id).delete();
            await db.jobs.where('projectId').equals(id).delete();
        });
        if (useProjectStore.getState().activeProjectId === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    },

    // --- Ingestion Logic ---

    async importDocument(file: File): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) throw new Error("No active project");
        
        const result = await importService.importFile(file, activeProjectId);
        
        await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            await db.chunks.where('projectId').equals(activeProjectId).delete();
            await db.jobs.where('projectId').equals(activeProjectId).delete();
            
            const newIds = await db.chunks.bulkAdd(result.chunks) as number[];
            await db.projects.update(activeProjectId, { 
                sourceFileName: result.fileName, 
                updatedAt: new Date() 
            });
            
            await this.enqueueJobs(newIds, activeProjectId, 10);
        });
    },

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
            const newIds = await db.chunks.bulkAdd(chunksToAdd) as number[];
            
            await this.enqueueJobs(newIds, activeProjectId, 10);
            await db.projects.update(activeProjectId, { updatedAt: new Date() });
        });
    },

    // --- Chunk Management ---

    async getChunk(id: number): Promise<Chunk | undefined> {
        return db.chunks.get(id);
    },

    async getNextChunk(currentChunkId: number): Promise<Chunk | undefined> {
        const current = await db.chunks.get(currentChunkId);
        if (!current) return undefined;

        return db.chunks
            .where('[projectId+orderInProject]')
            .equals([current.projectId, current.orderInProject + 1])
            .first();
    },

    async updateChunkText(chunkId: number, newText: string): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;

        const newHash = hashText(newText);
        
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            await db.chunks.update(chunkId, { 
                textContent: newText, 
                cleanTextHash: newHash, 
                status: 'pending', 
                updatedAt: new Date(),
                activeAssetId: null 
            });

            await this.upsertJob(chunkId, chunk.projectId, 50);
        });
    },

    async splitChunk(chunkId: number, cursorPosition: number): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const current = await db.chunks.get(chunkId);
            if (!current || cursorPosition <= 0) return;

            const t1 = current.textContent.substring(0, cursorPosition).trim();
            const t2 = current.textContent.substring(cursorPosition).trim();
            
            await db.chunks.update(chunkId, { 
                textContent: t1, 
                cleanTextHash: hashText(t1), 
                status: 'pending' 
            });

            await db.chunks
                .where('projectId').equals(current.projectId)
                .and(c => c.orderInProject > current.orderInProject)
                .modify(c => c.orderInProject += 1);
            
            const newId = await db.chunks.add({
                projectId: current.projectId, 
                orderInProject: current.orderInProject + 1,
                textContent: t2, 
                cleanTextHash: hashText(t2), 
                status: 'pending', 
                createdAt: new Date(), 
                updatedAt: new Date()
            }) as number;

            await this.upsertJob(chunkId, current.projectId, 50);
            await this.upsertJob(newId, current.projectId, 50);
        });
    },

    async mergeChunkWithNext(chunkId: number): Promise<void> {
        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const current = await db.chunks.get(chunkId);
            if (!current) return;

            const next = await db.chunks
                .where('[projectId+orderInProject]')
                .equals([current.projectId, current.orderInProject + 1])
                .first();
            
            if (!next) return;

            const newText = (current.textContent + " " + next.textContent).trim();
            
            await db.chunks.update(chunkId, { 
                textContent: newText, 
                cleanTextHash: hashText(newText), 
                status: 'pending' 
            });
            
            await db.chunks.delete(next.id!);
            await db.jobs.where('chunkId').equals(next.id!).delete();

            await db.chunks
                .where('projectId').equals(current.projectId)
                .and(c => c.orderInProject > next.orderInProject)
                .modify(c => c.orderInProject -= 1);
            
            await this.upsertJob(chunkId, current.projectId, 30);
        });
    },

    async generateChunkAudio(chunkId: number, priority = 100): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;
        
        // Don't queue if already generated or processing
        if (chunk.status === 'generated' || chunk.status === 'processing') return;

        await this.upsertJob(chunkId, chunk.projectId, priority);
    },

    /**
     * Helper for PlaybackEngine to ensure the next chunk is ready.
     * Checks if it needs generation and queues it if so.
     */
    async ensureChunkAudio(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (chunk && (chunk.status === 'pending' || chunk.status === 'failed_tts')) {
            await this.upsertJob(chunkId, chunk.projectId, 200); // High priority for lookahead
        }
    },

    // --- Internal Job Helpers ---
    
    async enqueueJobs(chunkIds: number[], projectId: number, priority: number) {
        const jobs = chunkIds.map(id => ({
            chunkId: id,
            projectId: projectId,
            status: 'pending' as const,
            priority,
            createdAt: new Date()
        }));
        await db.jobs.bulkAdd(jobs);
    },

    async upsertJob(chunkId: number, projectId: number, priority: number) {
        const existingJob = await db.jobs.where('chunkId').equals(chunkId).first();
        if (existingJob) {
            // Bump priority if we need it sooner
            await db.jobs.update(existingJob.id!, { 
                status: 'pending', 
                retryCount: 0, 
                priority: Math.max(existingJob.priority, priority) 
            });
        } else {
            await db.jobs.add({
                chunkId,
                projectId: projectId,
                status: 'pending',
                priority,
                createdAt: new Date()
            });
        }
    },

    async exportProjectAudio(projectId: number): Promise<void> {
        useProjectStore.getState().setExporting(true);
        try {
            const result = await exportService.exportProjectAudio(projectId);
            if (!result) return alert("No audio files generated yet.");
            
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            useProjectStore.getState().setExporting(false);
        }
    }
};