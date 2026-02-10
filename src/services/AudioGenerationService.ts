import { db } from '../db';
import { ttsService } from './TTSService';
import { storage } from './storage';
import { logger } from './Logger';

export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk || chunk.status === 'processing') return;

        const project = await db.projects.get(chunk.projectId);
        if (!project) {
            logger.error('AudioGen', 'Project not found for chunk', { chunkId, projectId: chunk.projectId });
            return;
        }

        await db.chunks.update(chunkId, { status: 'processing' });
        logger.info('AudioGen', `Starting synthesis for chunk ${chunkId}`, { textSnippet: chunk.textContent.slice(0, 30) });

        try {
            const voiceId = chunk.voiceOverride?.voiceId || project.voiceSettings?.voiceId || 'af_heart';
            const speed = chunk.voiceOverride?.speed || project.voiceSettings?.speed || 1.0;
            const config = { voice: voiceId, speed: speed, lang: 'en-us' };
            const filePath = `audio/${chunk.cleanTextHash}.wav`;

            const cached = await db.audioCache.get(chunk.cleanTextHash);
            const fileExists = cached && await storage.exists(cached.path);

            if (fileExists) {
                logger.debug('AudioGen', `Cache hit for hash ${chunk.cleanTextHash}`);
                await db.chunks.update(chunkId, { 
                    status: 'generated',
                    generatedFilePath: cached.path 
                });
                return;
            }

            const startTime = performance.now();
            const byteSize = await ttsService.generate(chunk.textContent, config, filePath);
            const duration = performance.now() - startTime;

            logger.info('AudioGen', `Synthesis complete in ${duration.toFixed(0)}ms`, { chunkId, byteSize });

            await db.audioCache.put({
                hash: chunk.cleanTextHash,
                path: filePath,
                byteSize: byteSize,
                mimeType: 'audio/wav',
                createdAt: new Date()
            });

            await db.chunks.update(chunkId, { 
                status: 'generated',
                generatedFilePath: filePath 
            });

        } catch (error) {
            logger.error('AudioGen', `Failed synthesis for chunk ${chunkId}`, { error: String(error) });
            await db.chunks.update(chunkId, { status: 'failed_tts' });
            throw error; 
        }
    }
};