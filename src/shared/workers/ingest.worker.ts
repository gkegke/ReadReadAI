import * as Comlink from 'comlink';
import * as pdfjsLib from 'pdfjs-dist';
import { chunkText } from '../lib/text-processor'; // FIXED PATH

// Configure PDFJS Worker inside the worker context
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';

class IngestWorker {
    async processFile(file: File, projectId: number) {
        let text = '';
        if (file.type === 'application/pdf') {
            text = await this.parsePdf(file);
        } else {
            text = await file.text();
        }
        return this.createChunks(text, projectId, file.name);
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

    private async parsePdf(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // @ts-ignore
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + ' ';
        }
        return fullText.trim();
    }
}

Comlink.expose(new IngestWorker());