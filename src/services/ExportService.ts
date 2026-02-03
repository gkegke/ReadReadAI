import JSZip from 'jszip';
import { db } from '../db';
import { storage } from './storage';

/**
 * Service responsible for packaging project assets into exportable formats.
 * Handles the bridge between IDB metadata, OPFS binary data, and JSZip.
 */
class ExportService {
    
    /**
     * Packages all generated audio files for a project into a ZIP file.
     * 
     * @param projectId - The ID of the project to export
     * @returns Promise<Blob> - The generated ZIP file as a Blob
     */
    async exportProjectAudio(projectId: number): Promise<{ blob: Blob, filename: string } | null> {
        const project = await db.projects.get(projectId);
        if (!project) throw new Error("Project not found");

        // 1. Fetch chunks in order
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

        // 2. Iterate chunks and gather audio
        for (const chunk of chunks) {
            if (chunk.status !== 'generated') continue;

            const cachedMeta = await db.audioCache.get(chunk.cleanTextHash);
            
            if (cachedMeta) {
                try {
                    // 3. Read binary from OPFS
                    // Note: In a production app with huge projects, we might want to do this 
                    // concurrently with P-Limit or similar, but for sequential ordering simplicity:
                    const blob = await storage.readFile(cachedMeta.path);
                    
                    // 4. Create a human-friendly filename
                    // Format: "001 - Start of the sentence... .wav"
                    const orderPrefix = (chunk.orderInProject + 1).toString().padStart(3, '0');
                    const textSnippet = this.sanitizeFilename(chunk.textContent.slice(0, 30));
                    const fileName = `${orderPrefix} - ${textSnippet}.wav`;

                    folder.file(fileName, blob);
                    filesAdded++;
                } catch (e) {
                    console.warn(`Skipping chunk ${chunk.id}: Audio file missing in OPFS`, e);
                }
            }
        }

        if (filesAdded === 0) {
            return null;
        }

        // 5. Generate ZIP
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