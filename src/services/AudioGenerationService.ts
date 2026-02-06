import { db } from '../db';
import { ttsService } from './TTSService';
import { storage } from './storage';

/**
 * Atomic service for generating audio for a single chunk.
 * This is a "Low-Level" service that does not know about queues or UI.
 */
export const AudioGenerationService = {
    async generate(chunkId: number): Promise<void> {
        const chunk = await db.chunks.get(chunkId);
        if (!chunk || chunk.status === 'processing') return;

        const project = await db.projects.get(chunk.projectId);
        if (!project) return;

        // 1. Mark as processing
        await db.chunks.update(chunkId, { status: 'processing' });

        try {
            const voiceId = chunk.voiceOverride?.voiceId || project.voiceSettings?.voiceId || 'af_heart';
            const speed = chunk.voiceOverride?.speed || project.voiceSettings?.speed || 1.0;

            const config = { voice: voiceId, speed: speed, lang: 'en-us' };
            const filePath = `audio/${chunk.cleanTextHash}.wav`;

            // 2. Check Cache First
            const cached = await db.audioCache.get(chunk.cleanTextHash);
            const fileExists = cached && await storage.exists(cached.path);

            if (fileExists) {
                await db.chunks.update(chunkId, { status: 'generated' });
                return;
            }

            // 3. Request TTS Inference
            const byteSize = await ttsService.generate(chunk.textContent, config, filePath);

            // 4. Update Registry
            await db.audioCache.put({
                hash: chunk.cleanTextHash,
                path: filePath,
                byteSize: byteSize,
                mimeType: 'audio/wav',
                createdAt: new Date()
            });

            // 5. Success
            await db.chunks.update(chunkId, { status: 'generated' });
        } catch (error) {
            console.error(`[AudioGenerationService] Failed for chunk ${chunkId}:`, error);
            await db.chunks.update(chunkId, { status: 'failed_tts' });
            throw error; // Re-throw so Manager can handle retries if needed
        }
    }
};