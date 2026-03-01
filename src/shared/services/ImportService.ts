import * as Comlink from 'comlink';
import IngestWorker from '../workers/ingest.worker?worker'; 
import type { Chunk } from '../types/schema';

export interface ImportResult {
  fileName: string;
  chunks: Omit<Chunk, 'id' | 'cleanTextHash'>[];
}

class ImportService {
    private worker: any = null;

    private getWorker() {
        if (!this.worker) {
            this.worker = Comlink.wrap(new IngestWorker());
        }
        return this.worker;
    }

    async importFile(file: File, projectId: number, afterOrderIndex?: number): Promise<ImportResult> {
        return await this.getWorker().processFile(file, projectId, afterOrderIndex);
    }

    async importText(text: string, projectId: number, afterOrderIndex?: number): Promise<ImportResult> {
        return await this.getWorker().processText(text, projectId, afterOrderIndex);
    }
}

export const importService = new ImportService();