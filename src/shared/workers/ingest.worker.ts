import * as Comlink from 'comlink';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { getDocumentProxy, extractText } from 'unpdf';
import { chunkText, hashText } from '../lib/text-processor';
import { IngestWorkerSchema } from '../types/schema';
import { logger } from '../services/Logger';
import { db } from '../db';

/**
 * IngestWorker (V4 - Thread Isolated DB Persistence)
 * [EPIC 6] Offloads heavy document parsing AND database insertion to a background thread.
 * This prevents massive IPC transfers from locking up the React UI thread.
 */
class IngestWorker {
    async processFile(file: File, projectId: number) {
        IngestWorkerSchema.processFile.parse({ file, projectId });

        let content = '';
        try {
            if (file.type === 'application/pdf') {
                content = await this.parsePdf(file);
            } else if (file.type === 'text/html') {
                content = await this.parseHtml(await file.text());
            } else {
                content = await file.text();
            }
        } catch (err) {
            logger.error('IngestWorker', `Parsing failed for ${file.name}`, err);
            throw new Error(`Failed to parse ${file.type} document.`);
        }

        return await this.ingestAndPersist(content, projectId, file.name);
    }

    async processText(text: string, projectId: number) {
        IngestWorkerSchema.processText.parse({ text, projectId });
        return await this.ingestAndPersist(text, projectId, 'Direct Input');
    }

    private async ingestAndPersist(text: string, projectId: number, fileName: string) {
        const rawChunks = await chunkText(text);
        const now = new Date();
        
        // [PHASE 3] Direct DB Write from Worker
        return await db.transaction('rw', [db.chapters, db.chunks, db.jobs], async () => {
            const chapterCount = await db.chapters.where('projectId').equals(projectId).count();
            const chunkCount = await db.chunks.where('projectId').equals(projectId).count();

            const chapterId = await db.chapters.add({
                projectId,
                name: fileName,
                orderInProject: chapterCount,
                createdAt: now
            });

            const chunksToAdd = rawChunks.map((content, index) => ({
                projectId,
                chapterId,
                orderInProject: chunkCount + index,
                textContent: content,
                cleanTextHash: hashText(content),
                status: 'pending' as const,
                createdAt: now,
                updatedAt: now
            }));

            const chunkIds = await db.chunks.bulkAdd(chunksToAdd, { allKeys: true });
            
            const jobs = (chunkIds as number[]).map(id => ({
                chunkId: id,
                projectId: projectId,
                status: 'pending' as const,
                priority: 10,
                createdAt: now
            }));

            await db.jobs.bulkAdd(jobs);

            return { fileName, count: rawChunks.length };
        });
    }

    private async parseHtml(html: string): Promise<string> {
        const { document } = parseHTML(html);
        const reader = new Readability(document);
        const article = reader.parse();
        return article ? article.textContent : document.body.textContent || '';
    }

    private async parsePdf(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const result = await extractText(pdf, { mergePages: true });

        if (Array.isArray(result.pages)) {
            return result.pages.map(p => p.textContent).join('\n\n');
        }
        return result.text || '';
    }
}

Comlink.expose(new IngestWorker());