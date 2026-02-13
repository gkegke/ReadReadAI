import * as Comlink from 'comlink';
import * as pdfjsLib from 'pdfjs-dist';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { chunkText } from '../lib/text-processor';
import { IngestWorkerSchema } from '../types/schema';

// Configure PDFJS Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';

class IngestWorker {
    /**
     * [CRITICAL] Zod Barrier Implementation
     * Validates file buffers and project metadata before parsing.
     */
    async processFile(file: File, projectId: number) {
        // Runtime validation
        IngestWorkerSchema.processFile.parse({ file, projectId });

        let content = '';
        if (file.type === 'application/pdf') {
            content = await this.parsePdf(file);
        } else if (file.type === 'text/html') {
            content = await this.parseHtml(await file.text());
        } else {
            content = await file.text();
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

    private async parsePdf(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullTextParts: string[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });
            const height = viewport.height;

            const topLimit = height * 0.95; 
            const bottomLimit = height * 0.05;

            const safeItems = textContent.items.filter((item: any) => {
                const y = item.transform[5];
                const str = item.str.trim();
                if (str.length === 0) return false;
                if (/^\d+$/.test(str) && (y > topLimit || y < bottomLimit)) return false;
                return true;
            });
            
            const pageText = safeItems.map((item: any) => item.str).join(' ');
            fullTextParts.push(pageText);
        }

        return fullTextParts.join('\n\n');
    }
}

Comlink.expose(new IngestWorker());