import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { importService } from './ImportService';
import { chunkText, hashText } from '../lib/text-processor';
import { ttsService } from './TTSService';
import { storage } from './storage';
import { exportService } from './ExportService';

/**
 * Service Layer for Project Operations.
 * Decouples logic from the React Hook state.
 */
export const ProjectActions = {
    
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
        await db.transaction('rw', db.projects, db.chunks, async () => {
            await db.projects.delete(id);
            await db.chunks.where('projectId').equals(id).delete();
        });
        const currentActive = useProjectStore.getState().activeProjectId;
        if (currentActive === id) {
            useProjectStore.getState().setActiveProject(null);
        }
    },

    async updateProjectName(id: number, name: string): Promise<void> {
        await db.projects.update(id, { name, updatedAt: new Date() });
    },

    async importDocument(file: File): Promise<void> {
        const { activeProjectId, setProcessing } = useProjectStore.getState();
        if (!activeProjectId) return;
        
        setProcessing(true);
        try {
            const result = await importService.importFile(file, activeProjectId);
            await db.transaction('rw', db.projects, db.chunks, async () => {
                await db.chunks.where('projectId').equals(activeProjectId).delete();
                await db.chunks.bulkAdd(result.chunks);
                await db.projects.update(activeProjectId, { sourceFileName: result.fileName, updatedAt: new Date() });
            });
        } finally {
            setProcessing(false);
        }
    },

    async importRawText(text: string): Promise<void> {
        const { activeProjectId, setProcessing } = useProjectStore.getState();
        if (!activeProjectId) return;
        
        setProcessing(true);
        try {
            const result = await importService.importText(text, activeProjectId);
            const count = await db.chunks.where('projectId').equals(activeProjectId).count();
            
            const chunksToAdd = result.chunks.map((c, i) => ({
                ...c,
                orderInProject: count + i
            }));

            const ids = await db.chunks.bulkAdd(chunksToAdd);
            
            // Auto-trigger generation
            (ids as number[]).forEach((id) => {
                 this.generateChunkAudio(id);
            });

            await db.projects.update(activeProjectId, { updatedAt: new Date() });
        } finally {
            setProcessing(false);
        }
    },

    async updateChunkText(chunkId: number, newText: string): Promise<void> {
        await db.chunks.update(chunkId, { 
            textContent: newText, 
            cleanTextHash: hashText(newText), 
            status: 'pending', 
            updatedAt: new Date() 
        });
    },

    async updateChunkOverride(chunkId: number, settings: { voiceId?: string, speed?: number }): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;

        const updatedOverride = { ...chunk.voiceOverride, ...settings };

        await db.chunks.update(chunkId, {
            voiceOverride: updatedOverride,
            status: 'pending',
            updatedAt: new Date()
        });

        this.generateChunkAudio(chunkId);
    },

    async insertChunks(precedingChunkId: number, text: string): Promise<void> {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;
        
        const newChunksText = chunkText(text);
        if (newChunksText.length === 0) return;

        let newIds: number[] = [];

        await db.transaction('rw', db.chunks, db.projects, async () => {
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

            newIds = await db.chunks.bulkAdd(newChunkObjects) as number[];
            await db.projects.update(activeProjectId, { updatedAt: now });
        });

        newIds.forEach(id => this.generateChunkAudio(id));
    },

    async mergeChunkWithNext(chunkId: number): Promise<void> {
        await db.transaction('rw', db.chunks, async () => {
            const current = await db.chunks.get(chunkId);
            if (!current) return;
            const next = await db.chunks.where('[projectId+orderInProject]').equals([current.projectId, current.orderInProject + 1]).first();
            if (!next) return;
            const newText = (current.textContent + " " + next.textContent).trim();
            
            await db.chunks.update(chunkId, { textContent: newText, cleanTextHash: hashText(newText), status: 'pending', updatedAt: new Date() });
            await db.chunks.delete(next.id!);
            await db.chunks.where('projectId').equals(current.projectId).and(c => c.orderInProject > next.orderInProject).modify(c => c.orderInProject -= 1);
        });
    },

    async splitChunk(chunkId: number, cursorPosition: number): Promise<void> {
        await db.transaction('rw', db.chunks, async () => {
            const current = await db.chunks.get(chunkId);
            if (!current || cursorPosition <= 0) return;
            const t1 = current.textContent.substring(0, cursorPosition).trim();
            const t2 = current.textContent.substring(cursorPosition).trim();
            
            await db.chunks.update(chunkId, { textContent: t1, cleanTextHash: hashText(t1), status: 'pending', updatedAt: new Date() });
            await db.chunks.where('projectId').equals(current.projectId).and(c => c.orderInProject > current.orderInProject).modify(c => c.orderInProject += 1);
            await db.chunks.add({
                projectId: current.projectId, orderInProject: current.orderInProject + 1,
                textContent: t2, cleanTextHash: hashText(t2), status: 'pending', createdAt: new Date(), updatedAt: new Date()
            });
        });
    },

    async generateChunkAudio(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if(!chunk || chunk.status === 'processing') return;

        const project = await db.projects.get(chunk.projectId);
        if(!project) return;

        await db.chunks.update(chunkId, { status: 'processing' });
        
        try {
            const voiceId = chunk.voiceOverride?.voiceId || project.voiceSettings?.voiceId || 'af_heart';
            const speed = chunk.voiceOverride?.speed || project.voiceSettings?.speed || 1.0;

            const config = { voice: voiceId, speed: speed, lang: 'en-us' };
            const fileName = `${chunk.cleanTextHash}.wav`;
            const filePath = `audio/${fileName}`;

            const byteSize = await ttsService.generate(chunk.textContent, config, filePath);
            
            await db.audioCache.put({ 
                hash: chunk.cleanTextHash, 
                path: filePath,
                byteSize: byteSize,
                mimeType: 'audio/wav',
                createdAt: new Date() 
            });

            await db.chunks.update(chunkId, { status: 'generated' });
        } catch (error) {
            console.error("Audio Generation Failed", error);
            await db.chunks.update(chunkId, { status: 'failed_tts' });
        }
    },

    async downloadChunkAudio(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;
        const cached = await db.audioCache.get(chunk.cleanTextHash);
        if (!cached) return;
        
        try {
            const blob = await storage.readFile(cached.path);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `readread-${chunk.id}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Error: " + e);
        }
    },

    async exportProjectAudio(projectId: number): Promise<void> {
        useProjectStore.getState().setExporting(true);
        try {
            const result = await exportService.exportProjectAudio(projectId);
            if (!result) {
                alert("No audio files generated yet.");
                return;
            }
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Export failed: " + (e as Error).message);
        } finally {
            useProjectStore.getState().setExporting(false);
        }
    }
};