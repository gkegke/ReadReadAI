import { db } from '../db';
import { useAudioStore } from '../store/useAudioStore';
import { useProjectStore } from '../store/useProjectStore';
import { AudioGenerationService } from './AudioGenerationService';

enum Priority {
    URGENT = 100,
    HIGH = 50,
    MEDIUM = 20,
    LOW = 1
}

class GenerationManager {
    private pendingIds = new Set<number>();
    private isProcessing = false;
    private visibleRange: { startIndex: number, endIndex: number } | null = null;
    private lookaheadDistance = 3;
    private processTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        useAudioStore.subscribe((state) => {
            if (state.activeChunkId) this.triggerProcess();
        });
    }

    public queue(chunkIds: number | number[]) {
        const ids = Array.isArray(chunkIds) ? chunkIds : [chunkIds];
        ids.forEach(id => this.pendingIds.add(id));
        this.triggerProcess();
    }

    public updateVisibleRange(startIndex: number, endIndex: number) {
        this.visibleRange = { startIndex, endIndex };
        this.triggerProcess();
    }

    private triggerProcess() {
        if (this.processTimeout) return;
        this.processTimeout = setTimeout(() => {
            this.processTimeout = null;
            this.processQueue();
        }, 100);
    }

    private async processQueue() {
        if (this.isProcessing || this.pendingIds.size === 0) return;

        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) return;

        this.isProcessing = true;

        try {
            const nextId = await this.pickNextTask(activeProjectId);
            
            if (nextId) {
                // CALL ATOMIC SERVICE
                await AudioGenerationService.generate(nextId);
                this.pendingIds.delete(nextId);
                
                setTimeout(() => {
                    this.isProcessing = false;
                    this.processQueue();
                }, 0);
            } else {
                this.isProcessing = false;
            }
        } catch (error) {
            this.isProcessing = false;
            setTimeout(() => this.triggerProcess(), 2000);
        }
    }

    private async pickNextTask(projectId: number): Promise<number | null> {
        const candidates = await db.chunks
            .where('id')
            .anyOf([...this.pendingIds])
            .and(c => c.projectId === projectId && c.status === 'pending')
            .toArray();

        if (candidates.length === 0) {
            this.pendingIds.clear();
            return null;
        }

        const { activeChunkId, queue } = useAudioStore.getState();
        const activeQueueIndex = activeChunkId ? queue.indexOf(activeChunkId) : -1;

        let bestScore = -1;
        let bestId: number | null = null;

        for (const chunk of candidates) {
            let score = Priority.LOW;
            if (chunk.id === activeChunkId) {
                score = Priority.URGENT;
            } else if (activeQueueIndex !== -1) {
                const chunkIndex = queue.indexOf(chunk.id!);
                if (chunkIndex > activeQueueIndex && chunkIndex <= activeQueueIndex + this.lookaheadDistance) {
                    score = Priority.HIGH + (this.lookaheadDistance - (chunkIndex - activeQueueIndex));
                }
            }

            if (score < Priority.MEDIUM && this.visibleRange) {
                const index = queue.indexOf(chunk.id!);
                if (index >= this.visibleRange.startIndex && index <= this.visibleRange.endIndex) {
                    score = Priority.MEDIUM;
                }
            }

            score += (1.0 / (chunk.orderInProject + 1));
            if (score > bestScore) {
                bestScore = score;
                bestId = chunk.id!;
            }
        }
        return bestId;
    }
}

export const generationManager = new GenerationManager();