import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { importService } from './ImportService';
import { chunkText, hashText } from '../lib/text-processor';
import { storage } from './storage';
import { exportService } from './ExportService';
import { jobQueueManager } from './JobQueueManager';

/**
 * Actions now focus purely on logic and DB mutations.
 * Loading states should be handled by the caller (Components) or reactively via useGlobalJobStatus.
 */
export const ProjectActions = {
    async createProject(name: string): Promise<number> {
        const now = new Date();
        const id = await db.projects.add({
            name, createdAt: now, updatedAt: now,
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });
        useProjectStore.getState().setActiveProject(id);
        return id;
    },

    async deleteProject(id: number): Promise<void> {
        await db.transaction('rw', db.projects, db.chunks, db.jobs, async () => {
            await db.projects.delete(id);
            await db.chunks.where('projectId').equals(id).delete();
            await db.jobs.where('projectId').equals(id).delete();
        });
        if (useProjectStore.getState().activeProjectId === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    },

    async importDocument(file: File): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;
        
        // Note: Caller should handle UI loading state for the import parsing phase
        const result = await importService.importFile(file, activeProjectId);
        let newIds: number[] = [];
        
        await db.transaction('rw', db.projects, db.chunks, db.jobs, async () => {
            await db.chunks.where('projectId').equals(activeProjectId).delete();
            await db.jobs.where('projectId').equals(activeProjectId).delete();
            
            newIds = await db.chunks.bulkAdd(result.chunks) as number[];
            await db.projects.update(activeProjectId, { sourceFileName: result.fileName, updatedAt: new Date() });
            
            const jobs = newIds.map(id => ({
                chunkId: id,
                projectId: activeProjectId,
                status: 'pending' as const,
                priority: 10,
                createdAt: new Date()
            }));
            await db.jobs.bulkAdd(jobs);
        });
        jobQueueManager.poke();
    },

    async importRawText(text: string): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;

        const result = await importService.importText(text, activeProjectId);
        const count = await db.chunks.where('projectId').equals(activeProjectId).count();
        
        await db.transaction('rw', db.chunks, db.projects, db.jobs, async () => {
            const chunksToAdd = result.chunks.map((c, i) => ({ ...c, orderInProject: count + i }));
            const newIds = await db.chunks.bulkAdd(chunksToAdd) as number[];
            
            const jobs = newIds.map(id => ({
                chunkId: id,
                projectId: activeProjectId,
                status: 'pending' as const,
                priority: 10,
                createdAt: new Date()
            }));
            await db.jobs.bulkAdd(jobs);
            
            await db.projects.update(activeProjectId, { updatedAt: new Date() });
        });
        jobQueueManager.poke();
    },

    async updateChunkText(chunkId: number, newText: string): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if(!chunk) return;

        await db.transaction('rw', db.chunks, db.jobs, async () => {
            await db.chunks.update(chunkId, { 
                textContent: newText, cleanTextHash: hashText(newText), status: 'pending', updatedAt: new Date() 
            });
            const existingJob = await db.jobs.where('chunkId').equals(chunkId).first();
            if(existingJob) {
                await db.jobs.update(existingJob.id!, { status: 'pending', retryCount: 0 });
            } else {
                await db.jobs.add({
                    chunkId,
                    projectId: chunk.projectId,
                    status: 'pending',
                    priority: 50,
                    createdAt: new Date()
                });
            }
        });
        jobQueueManager.poke();
    },

    async updateChunkOverride(chunkId: number, settings: { voiceId?: string, speed?: number }): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;
        
        await db.transaction('rw', db.chunks, db.jobs, async () => {
            await db.chunks.update(chunkId, {
                voiceOverride: { ...chunk.voiceOverride, ...settings },
                status: 'pending',
                updatedAt: new Date()
            });
            
            const existingJob = await db.jobs.where('chunkId').equals(chunkId).first();
            if(existingJob) {
                await db.jobs.update(existingJob.id!, { status: 'pending', retryCount: 0 });
            } else {
                await db.jobs.add({
                    chunkId,
                    projectId: chunk.projectId,
                    status: 'pending',
                    priority: 50,
                    createdAt: new Date()
                });
            }
        });
        jobQueueManager.poke();
    },

    async generateChunkAudio(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if(!chunk) return;

        await db.transaction('rw', db.jobs, async () => {
             const existingJob = await db.jobs.where('chunkId').equals(chunkId).first();
            if(existingJob) {
                await db.jobs.update(existingJob.id!, { status: 'pending', retryCount: 0, priority: 100 });
            } else {
                await db.jobs.add({
                    chunkId,
                    projectId: chunk.projectId,
                    status: 'pending',
                    priority: 100,
                    createdAt: new Date()
                });
            }
        });
        jobQueueManager.poke();
    },

    async insertChunks(precedingChunkId: number, text: string): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;
        const newChunksText = chunkText(text);
        if (newChunksText.length === 0) return;

        await db.transaction('rw', db.chunks, db.projects, db.jobs, async () => {
            const precedingChunk = await db.chunks.get(precedingChunkId);
            if (!precedingChunk) throw new Error("Chunk not found");
            const startOrder = precedingChunk.orderInProject + 1;
            const count = newChunksText.length;

            await db.chunks
                .where('projectId').equals(activeProjectId)
                .and(c => c.orderInProject >= startOrder)
                .modify(c => c.orderInProject += count);

            const now = new Date();
            const newChunkObjects = newChunksText.map((txt, idx) => ({
                projectId: activeProjectId,
                orderInProject: startOrder + idx,
                textContent: txt,
                cleanTextHash: hashText(txt),
                status: 'pending' as const,
                createdAt: now,
                updatedAt: now
            }));

            const newIds = await db.chunks.bulkAdd(newChunkObjects) as number[];
            const jobs = newIds.map(id => ({
                chunkId: id,
                projectId: activeProjectId,
                status: 'pending' as const,
                priority: 20,
                createdAt: now
            }));
            await db.jobs.bulkAdd(jobs);
            await db.projects.update(activeProjectId, { updatedAt: now });
        });
        jobQueueManager.poke();
    },
    
    async mergeChunkWithNext(chunkId: number): Promise<void> {
        await db.transaction('rw', db.chunks, db.jobs, async () => {
            const current = await db.chunks.get(chunkId);
            if (!current) return;
            const next = await db.chunks.where('[projectId+orderInProject]').equals([current.projectId, current.orderInProject + 1]).first();
            if (!next) return;
            const newText = (current.textContent + " " + next.textContent).trim();
            
            await db.chunks.update(chunkId, { textContent: newText, cleanTextHash: hashText(newText), status: 'pending', updatedAt: new Date() });
            await db.chunks.delete(next.id!);
            await db.chunks.where('projectId').equals(current.projectId).and(c => c.orderInProject > next.orderInProject).modify(c => c.orderInProject -= 1);
            
            await db.jobs.where('chunkId').equals(next.id!).delete();
             await db.jobs.add({
                chunkId,
                projectId: current.projectId,
                status: 'pending',
                priority: 30,
                createdAt: new Date()
            });
        });
        jobQueueManager.poke();
    },

    async splitChunk(chunkId: number, cursorPosition: number): Promise<void> {
        await db.transaction('rw', db.chunks, db.jobs, async () => {
            const current = await db.chunks.get(chunkId);
            if (!current || cursorPosition <= 0) return;
            const t1 = current.textContent.substring(0, cursorPosition).trim();
            const t2 = current.textContent.substring(cursorPosition).trim();
            
            await db.chunks.update(chunkId, { textContent: t1, cleanTextHash: hashText(t1), status: 'pending', updatedAt: new Date() });
            await db.chunks.where('projectId').equals(current.projectId).and(c => c.orderInProject > current.orderInProject).modify(c => c.orderInProject += 1);
            
            const newId = await db.chunks.add({
                projectId: current.projectId, orderInProject: current.orderInProject + 1,
                textContent: t2, cleanTextHash: hashText(t2), status: 'pending', createdAt: new Date(), updatedAt: new Date()
            }) as number;

            await db.jobs.add({ chunkId: chunkId, projectId: current.projectId, status: 'pending', priority: 50, createdAt: new Date() });
            await db.jobs.add({ chunkId: newId, projectId: current.projectId, status: 'pending', priority: 50, createdAt: new Date() });
        });
        jobQueueManager.poke();
    },

    async downloadChunkAudio(chunkId: number): Promise<void> {
         const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;
        const cached = await db.audioCache.get(chunk.cleanTextHash);
        if (!cached) return;
        const blob = await storage.readFile(cached.path);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readread-${chunk.id}.wav`;
        a.click();
        URL.revokeObjectURL(url);
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