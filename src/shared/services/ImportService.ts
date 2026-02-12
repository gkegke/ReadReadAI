import * as Comlink from 'comlink';
import IngestWorker from '../workers/ingest.worker?worker'; // FIXED PATH
import type { Chunk } from '../types/schema';

export interface ImportResult {
  fileName: string;
  chunks: Omit<Chunk, 'id' | 'cleanTextHash'>[];
}

/**
 * ImportService (V2)
 * Proxy service that offloads heavy PDF/Text processing to a background worker.
 */
class ImportService {
    private worker: any = null;

    private getWorker() {
        if (!this.worker) {
            // Instantiate worker via Vite's ?worker constructor
            this.worker = Comlink.wrap(new IngestWorker());
        }
        return this.worker;
    }

    async importFile(file: File, projectId: number): Promise<ImportResult> {
        return await this.getWorker().processFile(file, projectId);
    }

    async importText(text: string, projectId: number): Promise<ImportResult> {
        return await this.getWorker().processText(text, projectId);
    }
}

export const importService = new ImportService();