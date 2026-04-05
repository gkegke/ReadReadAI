import { create } from 'zustand';
import { audioPlaybackService, PlaybackState } from '../../features/studio/services/AudioPlaybackService';
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { storage } from '../services/storage';
import { db } from '../db';
import { liveQuery } from 'dexie';

interface AudioState {
  isPlaying: boolean;
  playbackState: PlaybackState;
  activeChunkId: number | null;
  currentTime: number;
  duration: number;
  playbackRate: number;
  togglePlay: () => void;
  setPlaybackSpeed: (rate: number) => void;
  skipToChunk: (id: number) => Promise<void>;
  playNext: () => Promise<void>;
  stopAll: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => {

  audioPlaybackService.bind(
    (currentTime, duration) => set({ currentTime, duration }),
    () => get().playNext(),
    (state: PlaybackState) => set({
        playbackState: state,
        isPlaying: state === PlaybackState.PLAYING
    })
  );

  return {
    isPlaying: false,
    playbackState: PlaybackState.IDLE,
    activeChunkId: null,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,

    setPlaybackSpeed: (rate: number) => {
        set({ playbackRate: rate });
        // Push the rate directly to the active audio engine in real-time
        audioPlaybackService.setRate(rate);
    },

    togglePlay: async () => {
        const { activeChunkId, isPlaying } = get();
        audioPlaybackService.initContext();

        if (activeChunkId) {
            audioPlaybackService.toggle();
        } else {
            const activeProject = (await db.projects.toArray())[0]?.id;
            if (!activeProject) return;
            const first = await db.chunks.where('projectId').equals(activeProject).sortBy('orderInProject');
            if (first[0]) get().skipToChunk(first[0].id!);
        }
    },

    skipToChunk: async (id: number) => {
        audioPlaybackService.initContext();
        set({ activeChunkId: id, currentTime: 0 });

        let chunk = await db.chunks.get(id);
        if (!chunk) return;

        // If the chunk isn't ready, we don't throw an error. We wait.
        if (chunk.status !== 'generated') {
            // Ensure generation is actually triggered
            await ProjectRepository.ensureChunkAudio(id);

            // Subscribe to this specific chunk until it's ready
            await new Promise<void>((resolve, reject) => {
                const observable = liveQuery(() => db.chunks.get(id)).subscribe({
                    next: (updated) => {
                        if (updated?.status === 'generated' && updated.generatedFilePath) {
                            chunk = updated;
                            observable.unsubscribe();
                            resolve();
                        }
                        if (updated?.status === 'failed_tts') {
                            observable.unsubscribe();
                            reject(new Error("Synthesis failed"));
                        }
                    },
                    error: reject
                });

                // Timeout safety: 30s limit for a single chunk
                setTimeout(() => {
                    observable.unsubscribe();
                    reject(new Error("Timeout waiting for audio"));
                }, 30000);
            });
        }

        try {
            if (!chunk?.generatedFilePath || !chunk?.cleanTextHash) throw new Error("Missing audio path");
            const blob = await storage.readFile(chunk.generatedFilePath);
            audioPlaybackService.playChunk(chunk.cleanTextHash, blob, get().playbackRate);
        } catch (err) {
            console.error("Storage read failed or wait timed out", err);
            // Don't stopAll() immediately, allow user to see the 'failed' state on the chunk
            set({ isPlaying: false, playbackState: PlaybackState.IDLE });
        }
    },

    playNext: async () => {
        const { activeChunkId } = get();
        if (!activeChunkId) return;

        const current = await db.chunks.get(activeChunkId);
        if (!current) return;

        const next = await db.chunks
            .where('[projectId+orderInProject]')
            .equals([current.projectId, current.orderInProject + 1])
            .first();

        if (next) {
            get().skipToChunk(next.id!);
        } else {
            get().stopAll();
        }
    },

    stopAll: () => {
        audioPlaybackService.stop();
        set({ isPlaying: false, activeChunkId: null, playbackState: PlaybackState.IDLE });
    }
  };
});
