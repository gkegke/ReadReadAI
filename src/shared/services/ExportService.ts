import JSZip from 'jszip';
import { db } from '../db';
import { storage } from './storage';
import { AudioEncoderService } from '../lib/audio-encoder';

/**
 * Service responsible for packaging project assets into exportable formats.
 */
class ExportService {
    
    async exportProjectAudio(projectId: number): Promise<{ blob: Blob, filename: string } | null> {
        const project = await db.projects.get(projectId);
        if (!project) throw new Error("Project not found");

        const chunks = await db.chunks
            .where('projectId')
            .equals(projectId)
            .sortBy('orderInProject');

        if (!chunks || chunks.length === 0) {
            throw new Error("No content to export.");
        }

        const zip = new JSZip();
        const folderName = this.sanitizeFilename(project.name);
        const folder = zip.folder(folderName);
        
        if(!folder) throw new Error("Failed to create zip folder");

        let filesAdded = 0;

        for (const chunk of chunks) {
            const filePath = chunk.generatedFilePath;
            
            if (filePath && chunk.status === 'generated') {
                try {
                    // 1. Read the raw internal WAV
                    const rawWav = await storage.readFile(filePath);
                    
                    // 2. Compress to Opus on-the-fly for export
                    const compressedAudio = await AudioEncoderService.encodeToOpus(rawWav);
                    
                    const orderPrefix = (chunk.orderInProject + 1).toString().padStart(3, '0');
                    const textSnippet = this.sanitizeFilename(chunk.textContent.slice(0, 30));
                    
                    // Use webm extension if compressed, otherwise wav
                    const ext = compressedAudio.type.includes('webm') ? 'webm' : 'wav';
                    const fileName = `${orderPrefix} - ${textSnippet}.${ext}`;

                    folder.file(fileName, compressedAudio);
                    filesAdded++;
                } catch (e) {
                    console.warn(`Skipping chunk ${chunk.id}: Audio file missing or corrupted`, e);
                }
            }
        }

        if (filesAdded === 0) {
            return null;
        }

        const content = await zip.generateAsync({ type: 'blob' });
        
        return {
            blob: content,
            filename: `${folderName}_audio_export.zip`
        };
    }

    private sanitizeFilename(text: string): string {
        return text.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    }
}

export const exportService = new ExportService();