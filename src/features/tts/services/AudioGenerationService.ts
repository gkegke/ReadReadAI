import { db } from '../../../shared/db';
import { ttsService } from './TTSService';
import { logger } from '../../../shared/services/Logger';
import { hashText } from '../../../shared/lib/text-processor';
import { storage } from '../../../shared/services/storage';
import { StorageQuotaService } from '../../../shared/services/storage/StorageQuotaService';

const activeGenerations = new Set<number>();

export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        if (activeGenerations.has(chunkId)) return;

        const chunk = await db.chunks.get(chunkId);
        if (!chunk || chunk.status === 'generated') return;

        activeGenerations.add(chunkId);

        try {
            const project = await db.projects.get(chunk.projectId);
            if (!project) throw new Error("Project not found");

            const voiceId = project.voiceSettings.voiceId;
            const currentRefHash = hashText(chunk.textContent, voiceId);

            const existingCache = await db.audioCache.get(currentRefHash);
            if (existingCache && await storage.exists(existingCache.path)) {
                await db.chunks.update(chunkId, {
                    status: 'generated',
                    cleanTextHash: currentRefHash,
                    generatedFilePath: existingCache.path,
                    updatedAt: new Date()
                });
                return;
            }

            await db.chunks.update(chunkId, { status: 'processing', cleanTextHash: currentRefHash });

            const config = { voice: voiceId, speed: project.voiceSettings.speed, lang: 'en-us' };
            const filePath = `audio/${currentRefHash}_${Date.now()}.wav`;

            const byteSize = await ttsService.generate(chunk.textContent, config, filePath);

            logger.info('AudioGeneration', `Chunk ${chunkId} synthesized. Output size: ${(byteSize / 1024).toFixed(2)}KB`);

if (byteSize < 100) {
    logger.error('AudioGeneration', `Chunk ${chunkId} produced suspiciously small output. Likely silent.`);
}

            const stillExists = await db.chunks.get(chunkId);
            if (!stillExists || stillExists.status !== 'processing') {
                logger.warn('AudioGeneration', `Generation for chunk ${chunkId} discarded: Chunk modified/deleted during synthesis.`);
                await storage.deleteFile(filePath);
                return;
            }

            await db.audioCache.put({
                hash: currentRefHash,
                path: filePath,
                byteSize,
                mimeType: 'audio/wav',
                createdAt: new Date(),
                lastAccessedAt: new Date()
            });

            await db.chunks.update(chunkId, {
                status: 'generated',
                generatedFilePath: filePath,
                updatedAt: new Date()
            });

            StorageQuotaService.checkAndPurge();

        } catch (e) {
            await db.chunks.update(chunkId, { status: 'failed_tts' });
            throw e;
        } finally {
            activeGenerations.delete(chunkId);
        }
    }
};
