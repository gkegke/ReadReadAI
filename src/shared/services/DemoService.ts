import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { hashText } from '../lib/text-processor';

const DEMO_CONTENT = [
    "Welcome to ReadReadAI! This is a fully offline, browser-based text-to-speech application.",
    "Everything you see and hear is happening right on your device. No data is sent to the cloud.",
    "The audio is generated using a high-performance AI model running in your browser via WebAssembly."
];

export const DemoService = {
    async checkAndCreateDemoProject() {
        const count = await db.projects.count();
        if (count > 0) return;

        const projectId = await db.projects.add({
            name: "Welcome to ReadReadAI",
            createdAt: new Date(),
            updatedAt: new Date(),
            voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
        });

        const chunks = DEMO_CONTENT.map((text, index) => ({
            projectId,
            orderInProject: index,
            textContent: text,
            cleanTextHash: hashText(text),
            status: 'pending' as const,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await db.chunks.bulkAdd(chunks);
        
        // CRITICAL: We also need to add jobs so the JobQueue picks them up
        const jobs = chunks.map((_, index) => ({
            chunkId: index + 1, // Dexie auto-inc starts at 1
            projectId,
            status: 'pending' as const,
            priority: 10,
            createdAt: new Date()
        }));
        await db.jobs.bulkAdd(jobs);

        useProjectStore.getState().setActiveProject(projectId);
    }
};