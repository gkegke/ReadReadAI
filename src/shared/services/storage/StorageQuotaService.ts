import { storage } from './index';
import { db } from '../../db';
import { logger } from '../Logger';
import { useSystemStore } from '../../store/useSystemStore';

/**
 * StorageQuotaService
 * [CRITICAL] Manages the lifecycle of physical files in OPFS.
 * Ensures that IndexedDB records and physical WAV files stay in sync.
 */
export const StorageQuotaService = {
    /**
     * processOrphanQueue
     * [EPIC 4] Background Garbage Collector.
     * Deletes files listed in the 'orphanedFiles' table during idle time.
     */
    async processOrphanQueue() {
        const processBatch = async () => {
            try {
                const table = db.table('orphanedFiles');
                if (!table) return;

                const orphans = await table.limit(10).toArray();
                if (orphans.length === 0) return;

                let deletedCount = 0;
                for (const orphan of orphans) {
                    try {
                        if (await storage.exists(orphan.path)) {
                            await storage.deleteFile(orphan.path);
                        }
                    } catch (e) {
                        // Silent skip if file is already gone or locked
                    }
                    await table.delete(orphan.id);
                    deletedCount++;
                }

                if (deletedCount > 0) {
                    logger.debug('Storage', `Background GC purged ${deletedCount} orphaned files.`);
                }

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

    queueNextBatch() {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => this.processOrphanQueue());
        } else {
            setTimeout(() => this.processOrphanQueue(), 1000);
        }
    },

    /**
     * reconcileStorage
     * [EPIC 1] Syncs OPFS with the Database.
     * Deletes physical files that no longer have a reference in IndexedDB.
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
                logger.info('Storage', `Cleaned ${purgeCount} orphaned audio files from disk.`);
            }
        } catch (e) {
            logger.error('Storage', 'Reconciliation failed', e);
        }
    },

    /**
     * checkAndPurge
     * [EPIC 6] Evaluates browser storage quota.
     * Sets a global state if the device is running out of space.
     */
    async checkAndPurge() {
        if (!navigator.storage?.estimate) return;
        
        const { usage, quota } = await navigator.storage.estimate();
        if (!usage || !quota) return;

        const ratio = usage / quota;
        const isFull = ratio > 0.90; // Threshold 90%
        
        useSystemStore.getState().setIsStorageFull(isFull);

        if (isFull) {
            logger.warn('Storage', `Quota threshold reached (${(ratio*100).toFixed(1)}%). Generation paused.`);
        }
    },

    /**
     * purgeOldestAudio
     * [EPIC 6] Manual cache invalidation trigger.
     * Deletes the 50 oldest audio files to free up space.
     */
    async purgeOldestAudio() {
        logger.info('Storage', 'Manual purge initiated...');
        
        const oldest = await db.audioCache.orderBy('lastAccessedAt').limit(50).toArray();
        if (oldest.length === 0) return;

        for (const record of oldest) {
            try {
                await storage.deleteFile(record.path);
                await db.audioCache.delete(record.hash);
                
                // Reset associated chunks to pending so UI reflects they need regeneration
                await db.chunks.where('cleanTextHash').equals(record.hash).modify({
                    status: 'pending',
                    generatedFilePath: null
                });
            } catch (e) {
                logger.warn('Storage', `Failed to delete ${record.path} during purge`, e);
            }
        }
        
        logger.info('Storage', `Manual purge completed. Freed ${oldest.length} slots.`);
        await this.checkAndPurge(); 
    },

    /**
     * touch
     * Updates LRU timestamp for a specific audio asset.
     */
    async touch(hash: string) {
        await db.audioCache.update(hash, { lastAccessedAt: new Date() });
    }
};