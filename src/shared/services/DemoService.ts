import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { hashText } from '../lib/text-processor';
import { logger } from './Logger';

const DEMO_CONTENT = [
    "Welcome to ReadReadAI! This is a fully offline, browser-based text-to-speech application.",
    "Everything you see and hear is happening right on your device. No data is sent to the cloud.",
    "The audio is generated using a high-performance AI model running in your browser via WebAssembly.",
    "Lowest quality outputs respectably fast even on lower end pcs since it runs on your CPU, not GPU.",
    "# Second Chapter",
    "Start a text chunk with # and it will be treated as a Chapter Header which unlocks a lot of useful functionality for all text chunks considered within it.",
    "Look at the STUDIO MAP in the inspector to the right to see what text chunks belong to what chapter along with a lot more.."
];

export const DemoService = {
    async checkAndCreateDemoProject(force = false) {
        if (!force) {
            const count = await db.projects.count();
            if (count > 0) return;
        }

        const name = force ? "Studio Documentation" : "Welcome to ReadReadAI";
        logger.info('DemoService', `Initializing demo project: ${name}`);

        return await db.transaction('rw', [db.projects, db.chunks, db.jobs], async () => {
            const projectId = await db.projects.add({
                name: name,
                createdAt: new Date(),
                updatedAt: new Date(),
                voiceSettings: { voiceId: 'af_heart', speed: 1.0 }
            }) as number;

            const chunkData = [
                {
                    projectId,
                    role: 'heading' as const,
                    orderInProject: 0,
                    textContent: "Introduction",
                    cleanTextHash: hashText("Introduction", 'af_heart'),
                    status: 'pending' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                ...DEMO_CONTENT.map((text, index) => {
                    const isHeading = text.startsWith('#');
                    const content = isHeading ? text.replace(/^#\s*/, '') : text;
                    return {
                        projectId,
                        role: (isHeading ? 'heading' : 'paragraph') as any,
                        orderInProject: index + 1,
                        textContent: content,
                        cleanTextHash: hashText(content, 'af_heart'),
                        status: 'pending' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                })
            ];

            // Capture the IDs from the bulk add
            const chunkIds = await db.chunks.bulkAdd(chunkData, { allKeys: true }) as number[];

            const jobs = chunkIds.map((id) => ({
                chunkId: id,
                projectId,
                status: 'pending' as const,
                priority: 10,
                retryCount: 0,
                createdAt: new Date()
            }));

            await db.jobs.bulkAdd(jobs);
            useProjectStore.getState().setActiveProject(projectId);

            return projectId;
        });
    }
}
