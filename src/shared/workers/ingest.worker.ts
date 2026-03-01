import * as Comlink from 'comlink';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { getDocumentProxy } from 'unpdf';
import { chunkText, hashText } from '../lib/text-processor';
import { IngestWorkerSchema } from '../types/schema';
import { logger } from '../services/Logger';
import { db } from '../db';

/**
 * IngestWorker (Epic 2 Upgrade - Streaming Ingestion)
 * Completely refactored to parse large PDFs iteratively to prevent OOM
 * and flush database entries in reasonable bounded batches.
 */
class IngestWorker {
    async processFile(file: File, projectId: number, afterOrderIndex?: number, onProgress?: (p: number, text: string) => void) {
        // [STABILITY] Validated strictly. Using raw object bypasses Comlink proxy signature mismatch.
        IngestWorkerSchema.processFile.parse({ file, projectId, afterOrderIndex });

        let rawChunks: string[] = [];

        try {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
                const numPages = pdf.numPages;
                
                if (onProgress) onProgress(5, `Extracting 0/${numPages} pages...`);

                // Read pages lazily, stream chunks to reduce string allocation ceiling
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const text = textContent.items.map((s: any) => s.str).join(' ');
                    
                    const pageChunks = await chunkText(text);
                    rawChunks.push(...pageChunks);

                    if (onProgress && i % 2 === 0) {
                        onProgress(5 + Math.floor((i / numPages) * 45), `Extracting ${i}/${numPages} pages...`);
                    }
                }
            } else if (file.type === 'text/html') {
                const content = await this.parseHtml(await file.text());
                rawChunks = await chunkText(content);
            } else {
                const content = await file.text();
                rawChunks = await chunkText(content);
            }
        } catch (err) {
            logger.error('IngestWorker', `Parsing failed for ${file.name}`, err);
            throw new Error(`Failed to parse ${file.type} document.`);
        }

        return await this.ingestAndPersist(rawChunks, projectId, file.name, afterOrderIndex, onProgress);
    }

    async processText(text: string, projectId: number, afterOrderIndex?: number, onProgress?: (p: number, text: string) => void) {
        IngestWorkerSchema.processText.parse({ text, projectId, afterOrderIndex });
        const rawChunks = await chunkText(text);
        return await this.ingestAndPersist(rawChunks, projectId, 'Direct Input', afterOrderIndex, onProgress);
    }

    private async ingestAndPersist(rawChunks: string[], projectId: number, fileName: string, afterOrderIndex?: number, onProgress?: any) {
        const now = new Date();
        const totalChunks = rawChunks.length;

        if (onProgress) onProgress(50, "Saving to database...");

        await db.transaction('rw', [db.chunks, db.jobs], async () => {
            const chunkCount = await db.chunks.where('projectId').equals(projectId).count();
            const startIndex = afterOrderIndex !== undefined ? afterOrderIndex + 1 : chunkCount;

            // [EPIC 4] Shift existing chunks downward if inserting into middle of project
            if (afterOrderIndex !== undefined) {
                const shiftAmount = totalChunks + 1; // +1 for the heading
                await db.chunks
                    .where('projectId').equals(projectId)
                    .filter(c => c.orderInProject > afterOrderIndex)
                    .modify(c => c.orderInProject += shiftAmount);
            }

            const BATCH_SIZE = 50;
            let currentOrder = startIndex;

            // Insert heading explicitly first
            const headingId = await db.chunks.add({
                projectId,
                role: 'heading' as const,
                orderInProject: currentOrder++,
                textContent: fileName,
                cleanTextHash: hashText(fileName),
                status: 'pending' as const,
                createdAt: now,
                updatedAt: now
            });

            await db.jobs.add({
                chunkId: headingId,
                projectId,
                status: 'pending' as const,
                priority: 10,
                createdAt: now
            });

            // [EPIC 2] Batch flush DB arrays
            for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
                const batch = rawChunks.slice(i, i + BATCH_SIZE);
                const chunksToAdd = batch.map((content, idx) => ({
                    projectId,
                    role: 'paragraph' as const,
                    orderInProject: currentOrder + i + idx,
                    textContent: content,
                    cleanTextHash: hashText(content),
                    status: 'pending' as const,
                    createdAt: now,
                    updatedAt: now
                }));

                const chunkIds = await db.chunks.bulkAdd(chunksToAdd, { allKeys: true });
                
                const jobs = (chunkIds as number[]).map(id => ({
                    chunkId: id,
                    projectId,
                    status: 'pending' as const,
                    priority: 10,
                    createdAt: now
                }));

                await db.jobs.bulkAdd(jobs);

                if (onProgress) {
                    onProgress(50 + Math.floor((i / totalChunks) * 50), `Saving batch ${Math.floor(i/BATCH_SIZE)+1}...`);
                }
            }
        });

        if (onProgress) onProgress(100, "Done!");
        return { fileName, count: totalChunks };
    }

    private async parseHtml(html: string): Promise<string> {
        const { document } = parseHTML(html);
        const reader = new Readability(document);
        const article = reader.parse();
        return article ? article.textContent : document.body.textContent || '';
    }
}

Comlink.expose(new IngestWorker());