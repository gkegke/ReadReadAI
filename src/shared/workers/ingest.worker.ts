import * as Comlink from 'comlink';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { getDocumentProxy, extractText } from 'unpdf';
import { chunkText } from '../lib/text-processor';
import { IngestWorkerSchema } from '../types/schema';
import { logger } from '../services/Logger';

/**
 * IngestWorker (V3 - Standardized via unpdf)
 * Offloads heavy document parsing to a background thread.
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

        return await this.createChunks(content, projectId, file.name);
    }

    async processText(text: string, projectId: number) {
        IngestWorkerSchema.processText.parse({ text, projectId });
        return await this.createChunks(text, projectId, 'Direct Input');
    }

    private async createChunks(text: string, projectId: number, fileName: string) {
        const rawChunks = await chunkText(text);
        const now = new Date();
        
        const chunks = rawChunks.map((content, index) => ({
            projectId,
            orderInProject: index,
            textContent: content,
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now
        }));

        return { fileName, chunks };
    }

    private async parseHtml(html: string): Promise<string> {
        const { document } = parseHTML(html);
        const reader = new Readability(document);
        const article = reader.parse();
        return article ? article.textContent : document.body.textContent || '';
    }

    /**
     * PDF Parsing via unpdf
     * [CRITICAL] Standardizes text extraction and provides better handling 
     * of multi-page documents than the raw PDF.js loop.
     */
    private async parsePdf(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF using unpdf's standardized proxy
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        
        // Extract text using unpdf's built-in extraction utility
        const result = await extractText(pdf, {
            mergePages: true
        });

        // Join page contents with double newlines to help the semantic chunker
        if (Array.isArray(result.pages)) {
            return result.pages.map(p => p.textContent).join('\n\n');
        }
        
        return result.text || '';
    }
}

Comlink.expose(new IngestWorker());