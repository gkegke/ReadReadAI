import { z } from 'zod';
import { type EntityTable } from 'dexie';

/**
 * BaseRepository
 * Moved to shared to support cross-feature inheritance.
 */
export abstract class BaseRepository<T extends { id?: number }, S extends z.ZodType<any>> {
    constructor(
        protected table: EntityTable<T, 'id'>,
        protected schema: S
    ) {}

    protected validate(data: unknown): T {
        return this.schema.parse(data);
    }

    async add(data: Omit<T, 'id'>): Promise<number> {
        const validated = this.validate(data);
        return await this.table.add(validated as T);
    }

    async put(data: T): Promise<number> {
        const validated = this.validate(data);
        return await this.table.put(validated as T);
    }

    /**
     * [FIX: CRITICAL] Added { allKeys: true } to Dexie bulkAdd.
     * Without this, bulkAdd returns only the LAST id inserted, 
     * causing .map() failures in callers.
     */
    async bulkAdd(data: Omit<T, 'id'>[]): Promise<number[]> {
        const validated = data.map(item => this.validate(item));
        return await this.table.bulkAdd(validated as T[], { allKeys: true }) as number[];
    }

    async update(id: number, data: Partial<T>): Promise<void> {
        await this.table.update(id, data);
    }

    async delete(id: number): Promise<void> {
        await this.table.delete(id);
    }

    async get(id: number): Promise<T | undefined> {
        return await this.table.get(id);
    }
}