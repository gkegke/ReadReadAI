import { db } from '../../../shared/db';
import { ttsService } from './TTSService';
import { storage } from '../../../shared/services/storage';
import { logger } from '../../../shared/services/Logger';
import { hashText } from '../../../shared/lib/text-processor';

export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk) return;

        const project = await db.projects.get(chunk.projectId);
        if (!project) return;

        const voiceId = project.voiceSettings.voiceId;
        const speed = project.voiceSettings.speed;

        // [ISSUE 2 FIX] Calculate a fresh hash including the current voice.
        // If the chunk's stored hash doesn't match this (e.g. voice changed),
        // we update the chunk's reference hash to ensure a new file is generated.
        const currentRefHash = hashText(chunk.textContent, voiceId);
        
        if (chunk.cleanTextHash !== currentRefHash) {
            await db.chunks.update(chunkId, { 
                cleanTextHash: currentRefHash,
                generatedFilePath: null // Break link to old voice audio
            });
        }

        await db.chunks.update(chunkId, { status: 'processing', updatedAt: new Date() });

        try {
            const config = { voice: voiceId, speed, lang: 'en-us' };
            const filePath = `audio/${currentRefHash}.wav`;

            const result = await ttsService.generate(chunk.textContent, config, filePath);

            await db.audioCache.put({
                hash: currentRefHash,
                path: filePath,
                byteSize: result.byteSize,
                mimeType: 'audio/wav',
                createdAt: new Date(),
                lastAccessedAt: new Date()
            });

            await db.chunks.update(chunkId, {
                status: 'generated',
                generatedFilePath: filePath,
                updatedAt: new Date()
            });
        } catch (e) {
            await db.chunks.update(chunkId, { status: 'failed_tts' });
            throw e;
        }
    }
};