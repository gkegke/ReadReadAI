import * as pdfjsLib from 'pdfjs-dist';
import { chunkText } from '../lib/text-processor';
import type { Chunk } from '../types/schema';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';

export interface ImportResult {
  fileName: string;
  chunks: Omit<Chunk, 'id'>[];
}

class ImportService {
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
      chunks: await this.createChunks(fullText, projectId)
    };
  }

  async importText(text: string, projectId: number): Promise<ImportResult> {
      return {
          fileName: 'Direct Input',
          chunks: await this.createChunks(text, projectId)
      };
  }

  // Updated to be Async to support LangChain
  private async createChunks(text: string, projectId: number): Promise<Omit<Chunk, 'id'>[]> {
    const rawChunks = await chunkText(text); // Awaited LangChain splitter
    const now = new Date();
    
    return rawChunks.map((chunkText, index) => ({
      projectId,
      orderInProject: index,
      textContent: chunkText,
      status: 'pending' as const, 
      activeAssetId: null,
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
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // @ts-expect-error - PDFJS typing quirk
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';
    }

    return fullText.trim();
  }
}

export const importService = new ImportService();