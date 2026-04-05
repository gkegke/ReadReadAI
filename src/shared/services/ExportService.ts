import JSZip from 'jszip';
import { db } from '../db';
import { storage } from './storage';
import { AudioEncoderService } from '../lib/audio-encoder';
import { deriveChapters } from '../lib/chapterUtils';
import { logger } from './Logger';

class ExportService {
    /**
     * Chapter-Aware Export
     * Packages selected chapters into a ZIP with deterministic naming.
     */
    async exportProjectAudio(
        projectId: number,
        selectedChapterIds?: string[]
    ): Promise<{ blob: Blob, filename: string } | null> {
        const project = await db.projects.get(projectId);
        if (!project) throw new Error("Project not found");

        const allChunks = await db.chunks
            .where('projectId')
            .equals(projectId)
            .sortBy('orderInProject');

        if (!allChunks || allChunks.length === 0) {
            throw new Error("No content to export.");
        }

        // Use the utility to get our hierarchy
        const chapters = deriveChapters(allChunks);

        // Filter based on user selection if provided
        const filteredChapters = selectedChapterIds
            ? chapters.filter(ch => selectedChapterIds.includes(ch.id))
            : chapters;

        if (filteredChapters.length === 0) return null;

        const zip = new JSZip();
        const rootFolder = this.sanitizeFilename(project.name);
        const folder = zip.folder(rootFolder);

        if (!folder) throw new Error("FileSystem Error: Failed to create zip container");

        let filesAdded = 0;

        // Iterative processing to manage memory pressure during Opus encoding
        for (let chIdx = 0; chIdx < filteredChapters.length; chIdx++) {
            const chapter = filteredChapters[chIdx];
            const chPrefix = (chIdx + 1).toString().padStart(3, '0');
            const chName = this.sanitizeFilename(chapter.title).slice(0, 30);

            for (let blockIdx = 0; blockIdx < chapter.chunks.length; blockIdx++) {
                const chunk = chapter.chunks[blockIdx];

                if (chunk.status === 'generated' && chunk.generatedFilePath) {
                    try {
                        const rawWav = await storage.readFile(chunk.generatedFilePath);

                        // [PERFORMANCE] Perform Opus compression for web-optimized delivery
                        const compressedAudio = await AudioEncoderService.encodeToOpus(rawWav);

                        const blockPrefix = (blockIdx + 1).toString().padStart(3, '0');
                        const textSnippet = this.sanitizeFilename(chunk.textContent.slice(0, 20));

                        // Structure: 001_Introduction_001_Welcome_to_Read.webm
                        const fileName = `${chPrefix}_${chName}_${blockPrefix}_${textSnippet}.webm`;

                        folder.file(fileName, compressedAudio);
                        filesAdded++;
                    } catch (e) {
                        logger.warn('Export', `Skipping chunk ${chunk.id}: File inaccessible`, e);
                    }
                }
            }
        }

        if (filesAdded === 0) return null;

        const content = await zip.generateAsync({ type: 'blob' });
        return {
            blob: content,
            filename: `${rootFolder}_audio_v3.zip`
        };
    }

    private sanitizeFilename(text: string): string {
        return text.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    }
}

export const exportService = new ExportService();
