import { db } from '../../../shared/db';
import { ttsService } from './TTSService';
import { logger } from '../../../shared/services/Logger';
import { hashText } from '../../../shared/lib/text-processor';

// [STABILITY] Simple in-memory lock to prevent dual-generation of the same ID
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
            
            await db.chunks.update(chunkId, { 
                status: 'processing', 
                cleanTextHash: currentRefHash,
                updatedAt: new Date() 
            });

            const config = { voice: voiceId, speed: project.voiceSettings.speed, lang: 'en-us' };
            const filePath = `audio/${currentRefHash}.wav`;

            const byteSize = await ttsService.generate(chunk.textContent, config, filePath);

            await db.audioCache.put({
                hash: currentRefHash,
                path: filePath,
                byteSize: byteSize,
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
        } finally {
            activeGenerations.delete(chunkId);
        }
    }
};