import { storage } from './index';
import { db } from '../../db';
import { logger } from '../Logger';
import { useSystemStore } from '../../store/useSystemStore';

export const StorageQuotaService = {
    async processOrphanQueue() {
        const processBatch = async () => {
            try {
                const table = db.table('orphanedFiles');
                const orphans = await table.limit(10).toArray();
                if (orphans.length === 0) return;

                let deletedCount = 0;
                for (const orphan of orphans) {
                    const isReferenced = await db.chunks.where('generatedFilePath').equals(orphan.path).count();
                    if (isReferenced === 0) {
                        if (await storage.exists(orphan.path)) {
                            await storage.deleteFile(orphan.path);
                            deletedCount++;
                        }
                        await db.audioCache.where('path').equals(orphan.path).delete();
                    }
                    await table.delete(orphan.id);
                }
                if (deletedCount > 0) {
                    // Update metrics after background cleanup
                    await this.checkAndPurge();
                }
                if (orphans.length === 10) this.queueNextBatch();
            } catch (err) {
                logger.error('Storage', 'Background GC Failed', err);
            }
        };

        if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(() => processBatch());
        else setTimeout(processBatch, 2000);
    },

    queueNextBatch() {
        setTimeout(() => this.processOrphanQueue(), 1000);
    },

    async reconcileStorage() {
        try {
            const files = await storage.listDirectory('audio');
            const cachedRecords = await db.audioCache.toArray();
            const validFilenames = new Set(cachedRecords.map(r => r.path.split('/').pop()!));

            for (const filename of files) {
                if (!validFilenames.has(filename)) {
                    await storage.deleteFile(`audio/${filename}`);
                }
            }
        } catch (e) {
            logger.error('Storage', 'Reconciliation failed', e);
        }
    },

    async checkAndPurge() {
        if (!navigator.storage?.estimate) return;
        const { usage, quota } = await navigator.storage.estimate();
        if (usage === undefined || quota === undefined) return;

        const store = useSystemStore.getState();
        store.setStorageMetrics(usage, quota);
        store.setIsStorageFull(usage / quota > 0.90);
    },

    async purgeAllAudioCache() {
        logger.info('Storage', 'Manual FULL purge initiated...');
        try {
            await storage.deleteDirectory('audio');
            await db.audioCache.clear();
            await db.table('orphanedFiles').clear();
            await db.chunks.toCollection().modify({
                status: 'pending',
                generatedFilePath: null,
                updatedAt: new Date()
            });
            // Clear the job queue immediately
            await db.jobs.clear();

            logger.info('Storage', 'Manual FULL purge completed.');
            // Immediate feedback
            await this.checkAndPurge();
        } catch (e) {
            logger.error('Storage', 'Failed to purge all audio', e);
        }
    }
};
