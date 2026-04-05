import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Polyfill Crypto for Node testing environments
if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

// Polyfill browser globals missing in pure Node collection phase
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    // @ts-ignore
    window.URL.revokeObjectURL = vi.fn();
}

// Strong mock for the Audio class to satisfy top-level instantiations
if (typeof globalThis.Audio === 'undefined') {
    (globalThis as any).Audio = class {
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        load = vi.fn();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
    };
}

import { resetDatabase } from '../src/shared/db';
import { beforeEach, vi } from 'vitest';

/**
 * Global Test Setup
 * Ensures IndexedDB is wiped between every single unit test.
 */
beforeEach(async () => {
    await resetDatabase();
});
