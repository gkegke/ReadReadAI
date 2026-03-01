import { db } from '../../../shared/db';
import { ttsService } from './TTSService';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';
import { StorageQuotaService } from '../../../shared/services/storage/StorageQuotaService';

export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        const initialChunk = await db.chunks.get(chunkId);
        
        if (!initialChunk || initialChunk.status === 'generated') return;

        // [EPIC 3] Mutex key that spans across JIT calls and background Web Workers
        const lockKey = `readread-gen-${initialChunk.cleanTextHash}`;

        await navigator.locks.request(lockKey, async () => {
            // [CRITICAL] Re-fetch the chunk inside the lock boundary. 
            // If the queue just generated this chunk while we waited for the lock, we must abort.
            const chunk = await db.chunks.get(chunkId);
            if (!chunk || chunk.status === 'generated') return;

            // [STABILITY] Check for space before attempting synthesis
            await StorageQuotaService.checkAndPurge();

            const project = await db.projects.get(chunk.projectId);
            if (!project) return;

            await db.chunks.update(chunkId, { status: 'processing', updatedAt: new Date() });

            try {
                const voiceId = chunk.voiceOverride?.voiceId || project.voiceSettings?.voiceId || 'af_heart';
                const speed = chunk.voiceOverride?.speed || project.voiceSettings?.speed || 1.0;
                const config = { voice: voiceId, speed: speed, lang: 'en-us' };
                const filePath = `audio/${chunk.cleanTextHash}.wav`;

                // Persistent Cache Check
                const cached = await db.audioCache.get(chunk.cleanTextHash);
                if (cached && await storage.exists(cached.path)) {
                    // [LRU] Update access time on cache hit
                    await StorageQuotaService.touch(chunk.cleanTextHash);
                    
                    await db.chunks.update(chunkId, { 
                        status: 'generated',
                        generatedFilePath: cached.path 
                    });
                    return;
                }

                const result = await ttsService.generate(chunk.textContent, config, filePath);

                await db.audioCache.put({
                    hash: chunk.cleanTextHash,
                    path: filePath,
                    byteSize: result.byteSize,
                    mimeType: 'audio/wav',
                    createdAt: new Date(),
                    lastAccessedAt: new Date() // [LRU] Initialize timestamp
                });

                await db.chunks.update(chunkId, { 
                    status: 'generated',
                    generatedFilePath: filePath,
                    waveformPeaks: result.peaks,
                    updatedAt: new Date()
                });

            } catch (error) {
                logger.error('AudioGen', `Failed synthesis for chunk ${chunkId}`, error);
                await db.chunks.update(chunkId, { status: 'failed_tts', updatedAt: new Date() });
                throw error; // Throw so JIT callers know it failed
            }
        });
    }
};