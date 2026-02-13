import { db } from '../../db';
import { storage } from './index';
import { logger } from '../Logger';

/**
 * StorageQuotaService
 * Implements a Proactive LRU Eviction Policy to prevent browser-enforced 
 * origin wipes on mobile/constrained devices.
 */
export const StorageQuotaService = {
    // We start evicting if we exceed 80% of available quota or 500MB (conservative)
    THRESHOLD_PERCENTAGE: 0.8,
    MIN_FREE_BYTES: 100 * 1024 * 1024, // 100MB

    async checkAndPurge(): Promise<void> {
        if (!navigator.storage?.estimate) return;

        const { quota, usage } = await navigator.storage.estimate();
        if (quota === undefined || usage === undefined) return;

        const usageRatio = usage / quota;
        const isLowSpace = usageRatio > this.THRESHOLD_PERCENTAGE || (quota - usage) < this.MIN_FREE_BYTES;

        if (isLowSpace) {
            logger.warn('StorageQuota', `Low space detected (${(usageRatio * 100).toFixed(1)}% used). Running eviction...`);
            await this.evictOldest(0.2); // Evict 20% of cached files
        }
    },

    /**
     * Evicts the least recently used audio files.
     * @param ratio - Percentage of the cache to clear (0.0 to 1.0)
     */
    async evictOldest(ratio: number): Promise<void> {
        const totalCount = await db.audioCache.count();
        const evictCount = Math.ceil(totalCount * ratio);

        if (evictCount === 0) return;

        // 1. Find oldest records
        const oldestRecords = await db.audioCache
            .orderBy('lastAccessedAt')
            .limit(evictCount)
            .toArray();

        logger.info('StorageQuota', `Evicting ${oldestRecords.length} items from LRU cache`);

        for (const record of oldestRecords) {
            try {
                // 2. Delete from physical storage
                await storage.deleteFile(record.path);
                
                // 3. Mark chunk as needing regeneration
                await db.chunks
                    .where('cleanTextHash')
                    .equals(record.hash)
                    .modify({ status: 'pending', generatedFilePath: null });

                // 4. Remove from cache registry
                await db.audioCache.delete(record.hash);
            } catch (err) {
                logger.error('StorageQuota', `Failed to evict ${record.hash}`, err);
            }
        }
    },

    /**
     * Updates the access timestamp for a cache hit.
     */
    async touch(hash: string): Promise<void> {
        await db.audioCache.update(hash, { lastAccessedAt: new Date() });
    }
};