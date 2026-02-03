import { create } from 'zustand';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { importService } from '../services/ImportService';
import { hashText, chunkText } from '../lib/text-processor'; // Added chunkText import
import { ttsService } from '../services/TTSService';
import { storage } from '../services/storage';
import { exportService } from '../services/ExportService';
import { useTTSStore } from './useTTSStore'; 
import { ModelStatus } from '../types/tts';

interface ProjectState {
  activeProjectId: number | null;
  isProcessing: boolean;
  isExporting: boolean;
  setActiveProject: (id: number | null) => void;
  createProject: (name: string) => Promise<number>;
  deleteProject: (id: number) => Promise<void>;
  updateProjectName: (id: number, name: string) => Promise<void>;
  importDocument: (file: File) => Promise<void>;
  importRawText: (text: string) => Promise<void>;
  updateChunkText: (chunkId: number, newText: string) => Promise<void>;
  insertChunks: (precedingChunkId: number, text: string) => Promise<void>; // New Action
  mergeChunkWithNext: (chunkId: number) => Promise<void>;
  splitChunk: (chunkId: number, cursorPosition: number) => Promise<void>;
  generateChunkAudio: (chunkId: number) => Promise<void>;
  downloadChunkAudio: (chunkId: number) => Promise<void>;
  exportProjectAudio: (projectId: number) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeProjectId: null,
  isProcessing: false,
  isExporting: false,

  setActiveProject: (id) => set({ activeProjectId: id }),

  createProject: async (name) => {
    const now = new Date();
    const id = await db.projects.add({
      name, createdAt: now, updatedAt: now,
      voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
    });
    set({ activeProjectId: id });
    return id;
  },

  deleteProject: async (id) => {
    await db.transaction('rw', db.projects, db.chunks, async () => {
      await db.projects.delete(id);
      await db.chunks.where('projectId').equals(id).delete();
    });
    set((state) => state.activeProjectId === id ? { activeProjectId: null } : {});
  },

  updateProjectName: async (id, name) => {
    await db.projects.update(id, { name, updatedAt: new Date() });
  },

  importDocument: async (file) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    set({ isProcessing: true });
    try {
        const result = await importService.importFile(file, activeProjectId);
        await db.transaction('rw', db.projects, db.chunks, async () => {
            await db.chunks.where('projectId').equals(activeProjectId).delete();
            await db.chunks.bulkAdd(result.chunks);
            await db.projects.update(activeProjectId, { sourceFileName: result.fileName, updatedAt: new Date() });
        });
    } finally {
        set({ isProcessing: false });
    }
  },

  importRawText: async (text) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    set({ isProcessing: true });
    try {
        const result = await importService.importText(text, activeProjectId);
        await db.transaction('rw', db.projects, db.chunks, async () => {
            await db.chunks.where('projectId').equals(activeProjectId).delete();
            await db.chunks.bulkAdd(result.chunks);
            await db.projects.update(activeProjectId, { sourceFileName: result.fileName, updatedAt: new Date() });
        });
    } finally {
        set({ isProcessing: false });
    }
  },

  updateChunkText: async (chunkId, newText) => {
    await db.chunks.update(chunkId, { 
        textContent: newText, cleanTextHash: hashText(newText), status: 'pending', updatedAt: new Date()
    });
  },

  // Epic 2: Dynamic Flow Editing
  insertChunks: async (precedingChunkId, text) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    
    // 1. Process Text locally
    const newChunksText = chunkText(text);
    if (newChunksText.length === 0) return;

    await db.transaction('rw', db.chunks, db.projects, async () => {
        const precedingChunk = await db.chunks.get(precedingChunkId);
        if (!precedingChunk) throw new Error("Chunk not found");
        
        const startOrder = precedingChunk.orderInProject + 1;
        const count = newChunksText.length;

        // 2. Shift subsequent chunks to make space
        // This avoids Linked List complexity by keeping simple integer ordering
        await db.chunks
            .where('projectId').equals(activeProjectId)
            .and(c => c.orderInProject >= startOrder)
            .modify(c => c.orderInProject += count);

        // 3. Insert new chunks
        const now = new Date();
        const newChunkObjects = newChunksText.map((txt, idx) => ({
            projectId: activeProjectId,
            orderInProject: startOrder + idx,
            textContent: txt,
            cleanTextHash: hashText(txt),
            status: 'pending' as const,
            noteContent: null,
            createdAt: now,
            updatedAt: now
        }));

        await db.chunks.bulkAdd(newChunkObjects);
        await db.projects.update(activeProjectId, { updatedAt: now });
    });
  },

  mergeChunkWithNext: async (chunkId) => {
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

  splitChunk: async (chunkId, cursorPosition) => {
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

  generateChunkAudio: async (chunkId) => {
      const chunk = await db.chunks.get(chunkId);
      if(!chunk || chunk.status === 'processing') return;

      const project = await db.projects.get(chunk.projectId);
      if(!project) return;

      const cachedMeta = await db.audioCache.get(chunk.cleanTextHash);
      if (cachedMeta) {
          const exists = await storage.exists(cachedMeta.path);
          if (exists) {
              await db.chunks.update(chunkId, { status: 'generated' });
              return;
          } else {
              await db.audioCache.delete(chunk.cleanTextHash);
          }
      }

      await db.chunks.update(chunkId, { status: 'processing' });
      
      try {
          const config = { 
              voice: project.voiceSettings?.voiceId || 'af_heart', 
              speed: project.voiceSettings?.speed || 1.0, 
              lang: 'en-us' 
          };
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

  downloadChunkAudio: async (chunkId) => {
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

  exportProjectAudio: async (projectId) => {
      set({ isExporting: true });
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
          set({ isExporting: false });
      }
  }
}));

export const useProjects = () => useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray());

export const useActiveProjectChunks = (projectId: number | null) => {
    return useLiveQuery(async () => {
        if (projectId === null) return [];
        return await db.chunks.where('projectId').equals(projectId).sortBy('orderInProject');
    }, [projectId]);
};