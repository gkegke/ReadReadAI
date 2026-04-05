import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Polyfill Crypto for Node testing environments
if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

import { resetDatabase } from '../src/shared/db';
import { beforeEach } from 'vitest';

/**
 * Global Test Setup
 * Ensures IndexedDB is wiped between every single unit test.
 */
beforeEach(async () => {
    await resetDatabase();
});
