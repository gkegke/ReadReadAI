import * as Comlink from 'comlink';
import * as pdfjsLib from 'pdfjs-dist';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom/worker';
import { chunkText } from '../lib/text-processor';

// Configure PDFJS Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';

class IngestWorker {
    async processFile(file: File, projectId: number) {
        console.log(`[IngestWorker] Processing file: ${file.name} (${file.type})`);
        
        let content = '';
        if (file.type === 'application/pdf') {
            content = await this.parsePdf(file);
        } else if (file.type === 'text/html') {
            content = await this.parseHtml(await file.text());
        } else {
            content = await file.text();
        }

        return this.createChunks(content, projectId, file.name);
    }

    async processText(text: string, projectId: number) {
        return this.createChunks(text, projectId, 'Direct Input');
    }

    private createChunks(text: string, projectId: number, fileName: string) {
        const rawChunks = chunkText(text);
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
     * Enhanced PDF Extraction
     * Uses strict heuristic to strip headers/footers based on Y-position.
     */
    private async parsePdf(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullTextParts: string[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });
            const height = viewport.height;

            // Heuristic: Define "Safe Zone" (exclude top 5% and bottom 5% of page)
            const topLimit = height * 0.95; 
            const bottomLimit = height * 0.05;

            const safeItems = textContent.items.filter((item: any) => {
                // Transform[5] is the Y coordinate in PDF space (0,0 at bottom-left usually)
                const y = item.transform[5];
                const str = item.str.trim();
                
                // 1. Exclude strictly empty
                if (str.length === 0) return false;
                
                // 2. Exclude typical Page Numbers (solitary digits at edges)
                if (/^\d+$/.test(str) && (y > topLimit || y < bottomLimit)) return false;

                return true;
            });
            
            // Reconstruct text
            const pageText = safeItems.map((item: any) => item.str).join(' ');
            fullTextParts.push(pageText);
        }

        return fullTextParts.join('\n\n');
    }
}

Comlink.expose(new IngestWorker());