import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { hashText } from '../lib/text-processor';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository';

const DEMO_CONTENT = [
    "Welcome to ReadReadAI! This is a fully offline, browser-based text-to-speech application.",
    "Everything you see and hear is happening right on your device. No data is sent to the cloud.",
    "The audio is generated using a high-performance AI model running in your browser via WebAssembly."
];

export const DemoService = {
    async checkAndCreateDemoProject() {
        const count = await db.projects.count();
        if (count > 0) return;

        await db.transaction('rw', [db.projects, db.chapters, db.chunks, db.jobs], async () => {
            const projectId = await db.projects.add({
                name: "Welcome to ReadReadAI",
                createdAt: new Date(),
                updatedAt: new Date(),
                voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
            });

            // [EPIC 2] Enforce strict hierarchy creation
            const chapterId = await db.chapters.add({
                projectId,
                name: "Introduction",
                orderInProject: 0,
                createdAt: new Date()
            });

            const chunkData = DEMO_CONTENT.map((text, index) => ({
                projectId,
                chapterId, // [EPIC 2] Bind to required chapter hierarchy
                orderInProject: index,
                textContent: text,
                cleanTextHash: hashText(text),
                status: 'pending' as const,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const chunkIds = await ChunkRepository.bulkAdd(chunkData);
            
            const jobs = chunkIds.map((id) => ({
                chunkId: id,
                projectId,
                status: 'pending' as const,
                priority: 10,
                createdAt: new Date()
            }));

            await db.jobs.bulkAdd(jobs);
            useProjectStore.getState().setActiveProject(projectId);
        });
    }
};