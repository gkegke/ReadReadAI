import { db } from '../../../shared/db';
import { ttsService } from './TTSService';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';

export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        
        // CRITICAL: Gatekeeping to prevent race conditions or duplicate synthesis
        if (!chunk || chunk.status === 'processing' || chunk.status === 'generated') return;

        const project = await db.projects.get(chunk.projectId);
        if (!project) return;

        await db.chunks.update(chunkId, { status: 'processing', updatedAt: new Date() });

        try {
            const voiceId = chunk.voiceOverride?.voiceId || project.voiceSettings?.voiceId || 'af_heart';
            const speed = chunk.voiceOverride?.speed || project.voiceSettings?.speed || 1.0;
            const config = { voice: voiceId, speed: speed, lang: 'en-us' };
            const filePath = `audio/${chunk.cleanTextHash}.wav`;

            // Check persistent cache first
            const cached = await db.audioCache.get(chunk.cleanTextHash);
            if (cached && await storage.exists(cached.path)) {
                logger.debug('AudioGen', `Cache hit for chunk ${chunkId}`);
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
                createdAt: new Date()
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
        }
    }
};