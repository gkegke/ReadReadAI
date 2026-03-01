import * as Comlink from 'comlink';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { getDocumentProxy, extractText } from 'unpdf';
import { chunkText, hashText } from '../lib/text-processor';
import { IngestWorkerSchema } from '../types/schema';
import { logger } from '../services/Logger';
import { db } from '../db';

class IngestWorker {
    async processFile(file: File, projectId: number, afterOrderIndex?: number) {
        IngestWorkerSchema.processFile.parse({ file, projectId, afterOrderIndex });

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

        return await this.ingestAndPersist(content, projectId, file.name, afterOrderIndex);
    }

    async processText(text: string, projectId: number, afterOrderIndex?: number) {
        IngestWorkerSchema.processText.parse({ text, projectId, afterOrderIndex });
        return await this.ingestAndPersist(text, projectId, 'Direct Input', afterOrderIndex);
    }

    private async ingestAndPersist(text: string, projectId: number, fileName: string, afterOrderIndex?: number) {
        const rawChunks = await chunkText(text);
        const now = new Date();
        
        return await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const chunkCount = await db.chunks.where('projectId').equals(projectId).count();
            const startIndex = afterOrderIndex !== undefined ? afterOrderIndex + 1 : chunkCount;

            // [EPIC 4] Shift existing chunks downward if inserting into middle of project
            if (afterOrderIndex !== undefined) {
                const shiftAmount = rawChunks.length + 1; // +1 for the heading
                await db.chunks
                    .where('projectId').equals(projectId)
                    .filter(c => c.orderInProject > afterOrderIndex)
                    .modify(c => c.orderInProject += shiftAmount);
            }

            const chunksToAdd = [];
            
            chunksToAdd.push({
                projectId,
                role: 'heading' as const,
                orderInProject: startIndex,
                textContent: fileName,
                cleanTextHash: hashText(fileName),
                status: 'pending' as const,
                createdAt: now,
                updatedAt: now
            });

            rawChunks.forEach((content, index) => {
                chunksToAdd.push({
                    projectId,
                    role: 'paragraph' as const,
                    orderInProject: startIndex + 1 + index,
                    textContent: content,
                    cleanTextHash: hashText(content),
                    status: 'pending' as const,
                    createdAt: now,
                    updatedAt: now
                });
            });

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