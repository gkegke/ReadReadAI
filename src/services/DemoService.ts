import { db } from '../db';
import { useProjectStore } from '../store/useProjectStore';
import { hashText } from '../lib/text-processor';

const DEMO_CONTENT = [
    "Welcome to ReadReadAI! This is a fully offline, browser-based text-to-speech application.",
    "Everything you see and hear is happening right on your device. No data is sent to the cloud.",
    "You can import PDF or Text files using the button on the dashboard.",
    "The audio is generated using a high-performance AI model running in your browser via WebAssembly.",
    "Try clicking on a chunk to edit the text, or use the split and merge tools to adjust the flow.",
    "Enjoy listening to your documents private and offline!"
];

export const DemoService = {
    /**
     * Checks if the database is empty (no projects).
     * If so, creates a Welcome project and populates it with chunks.
     */
    async checkAndCreateDemoProject() {
        const count = await db.projects.count();
        if (count > 0) return;

        console.log("Initializing Demo Project...");

        // 1. Create Project
        const projectId = await db.projects.add({
            name: "Welcome to ReadReadAI",
            createdAt: new Date(),
            updatedAt: new Date(),
            voiceSettings: { voiceId: 'af_sarah', speed: 1.0 }
        });

        // 2. Create Chunks
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
        
        // 3. Set Active
        useProjectStore.getState().setActiveProject(projectId);
        
        // 4. Trigger Audio Generation for the first chunk to ensure immediate delight
        // We delay slightly to ensure the store subscription updates
        setTimeout(() => {
             const { generateChunkAudio } = useProjectStore.getState();
             db.chunks.where({ projectId }).first().then(chunk => {
                 if(chunk && chunk.id) {
                     generateChunkAudio(chunk.id);
                 }
             });
        }, 1000);
    }
};