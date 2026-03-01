import { storage } from './index';
import { db } from '../../db';
import { logger } from '../Logger';

/**
 * StorageQuotaService (Epic 1 & Epic 4: The Garbage Collector)
 */
export const StorageQuotaService = {
    /**
     * [EPIC 4] Non-blocking OPFS sweeper.
     * [FIX] Uses db.table() accessor to prevent "undefined" errors if Dexie
     * property injection is delayed during schema upgrades.
     */
    async processOrphanQueue() {
        const processBatch = async () => {
            try {
                // Defensive check: Ensure orphanedFiles exists in the schema
                const table = db.table('orphanedFiles');
                if (!table) return;

                const orphans = await table.limit(10).toArray();
                if (orphans.length === 0) return;

                let deletedCount = 0;
                for (const orphan of orphans) {
                    try {
                        // Check if file exists before attempting delete to avoid noise
                        if (await storage.exists(orphan.path)) {
                            await storage.deleteFile(orphan.path);
                        }
                    } catch (e) {
                        // Log but continue; file might already be gone
                        logger.debug('Storage', `GC: File ${orphan.path} skip.`, e);
                    }
                    await table.delete(orphan.id);
                    deletedCount++;
                }

                if (deletedCount > 0) {
                    logger.debug('Storage', `Background GC purged ${deletedCount} orphaned files.`);
                }

                // If we found 10, there are likely more. Queue another idle block.
                if (orphans.length === 10) {
                    this.queueNextBatch();
                }
            } catch (err) {
                logger.error('Storage', 'Background GC Batch Failed', err);
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => processBatch());
        } else {
            setTimeout(() => processBatch(), 2000);
        }
    },

    /**
     * Helper to re-queue the next batch safely
     */
    queueNextBatch() {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => this.processOrphanQueue());
        } else {
            setTimeout(() => this.processOrphanQueue(), 1000);
        }
    },

    /**
     * [EPIC 1] Boot-time reconciliation.
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