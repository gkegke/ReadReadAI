import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - Vite specific import for worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { chunkText, hashText } from '../lib/text-processor';
import type { Chunk } from '../types/schema';

// Configure PDF.js worker using local asset via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ImportResult {
  fileName: string;
  chunks: Omit<Chunk, 'id'>[];
}

class ImportService {
  /**
   * Main entry point to import a file.
   * Detects type and delegates to specific parser.
   */
  async importFile(file: File, projectId: number): Promise<ImportResult> {
    let fullText = '';

    if (file.type === 'application/pdf') {
      fullText = await this.parsePdf(file);
    } else if (file.type === 'text/plain') {
      fullText = await this.parseTxt(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    return {
      fileName: file.name,
      chunks: this.createChunks(fullText, projectId)
    };
  }

  /**
   * Import raw text directly (e.g. from Paste Modal)
   */
  async importText(text: string, projectId: number): Promise<ImportResult> {
      return {
          fileName: 'Direct Input',
          chunks: this.createChunks(text, projectId)
      };
  }

  private createChunks(text: string, projectId: number): Omit<Chunk, 'id'>[] {
    // Process text into chunks
    const rawChunks = chunkText(text);

    const now = new Date();
    return rawChunks.map((chunkText, index) => ({
      projectId,
      orderInProject: index,
      textContent: chunkText,
      cleanTextHash: hashText(chunkText),
      status: 'pending' as const,
      noteContent: null,
      createdAt: now,
      updatedAt: now
    }));
  }

  private async parseTxt(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private async parsePdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Iterate over all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ');
        
      fullText += pageText + ' ';
    }

    return fullText.trim();
  }
}

export const importService = new ImportService();