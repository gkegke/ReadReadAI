import { storage } from './index';
import { db } from '../../db';
import { logger } from '../Logger';

/**
 * StorageQuotaService (Epic 1: The Garbage Collector)
 * Manages OPFS disk pressure and reconciles "Zombie Files".
 */
export const StorageQuotaService = {
    /**
     * [EPIC 1] Scans the OPFS tree and deletes any .wav file not 
     * present in the IndexedDB audioCache.
     */
    async reconcileStorage() {
        try {
            logger.info('Storage', 'Starting OPFS Reconciliation...');
            const files = await storage.listDirectory('audio');
            const cachedRecords = await db.audioCache.toArray();
            const validHashes = new Set(cachedRecords.map(r => `${r.hash}.wav`));

            let purgeCount = 0;
            for (const filename of files) {
                if (!validHashes.has(filename)) {
                    await storage.deleteFile(`audio/${filename}`);
                    purgeCount++;
                }
            }

            if (purgeCount > 0) {
                logger.info('Storage', `Cleaned ${purgeCount} orphaned audio files.`);
            }
        } catch (e) {
            logger.error('Storage', 'Reconciliation failed', e);
        }
    },

    async checkAndPurge() {
        if (!navigator.storage?.estimate) return;
        
        const { usage, quota } = await navigator.storage.estimate();
        if (!usage || !quota) return;

        // If usage > 85%, purge LRU files
        if (usage / quota > 0.85) {
            logger.warn('Storage', 'Quota threshold reached. Purging LRU cache...');
            const lru = await db.audioCache.orderBy('lastAccessedAt').limit(50).toArray();
            
            for (const record of lru) {
                await storage.deleteFile(record.path);
                await db.audioCache.delete(record.hash);
            }
        }
    },

    async touch(hash: string) {
        await db.audioCache.update(hash, { lastAccessedAt: new Date() });
    }
};