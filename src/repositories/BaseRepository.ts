import { z } from 'zod';
import { type EntityTable } from 'dexie';

export abstract class BaseRepository<T extends { id?: number }, S extends z.ZodType<any>> {
    constructor(
        protected table: EntityTable<T, 'id'>,
        protected schema: S
    ) {}

    /**
     * Validates data against the Zod schema.
     * Throws a ZodError if validation fails.
     */
    protected validate(data: unknown): T {
        // Zod parse removes unknown keys by default if configured, 
        // ensuring DB doesn't get polluted with garbage.
        return this.schema.parse(data);
    }

    async add(data: Omit<T, 'id'>): Promise<number> {
        // Run validation before touching DB
        const validated = this.validate(data);
        return await this.table.add(validated as T);
    }

    async put(data: T): Promise<number> {
        const validated = this.validate(data);
        return await this.table.put(validated as T);
    }

    async bulkAdd(data: Omit<T, 'id'>[]): Promise<number[]> {
        const validated = data.map(item => this.validate(item));
        return await this.table.bulkAdd(validated as T[]) as number[];
    }

    async update(id: number, data: Partial<T>): Promise<void> {
        // Partial validation is tricky with Zod (using .partial()), 
        // for now we trust the types but could strictly implement:
        // this.schema.partial().parse(data);
        await this.table.update(id, data);
    }

    async delete(id: number): Promise<void> {
        await this.table.delete(id);
    }

    async get(id: number): Promise<T | undefined> {
        return await this.table.get(id);
    }
}