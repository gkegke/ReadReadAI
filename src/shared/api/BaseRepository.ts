import { z } from 'zod';
import { type EntityTable } from 'dexie';

/**
 * BaseRepository
 * Standardizes ID handling across all Dexie tables.
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
        return await this.table.add(validated as T) as number;
    }

    async put(data: T): Promise<number> {
        const validated = this.validate(data);
        return await this.table.put(validated as T) as number;
    }

    async bulkAdd(data: Omit<T, 'id'>[]): Promise<number[]> {
        const validated = data.map(item => this.validate(item));
        return await this.table.bulkAdd(validated as T[], { allKeys: true }) as number[];
    }

    async update(id: number, data: Partial<T>): Promise<void> {
        // @ts-ignore - Dexie's update typing can be overly restrictive with generics
        await this.table.update(id, data);
    }

    async delete(id: number): Promise<void> {
        await this.table.delete(id as any);
    }

    async get(id: number): Promise<T | undefined> {
        return await this.table.get(id as any);
    }
}
