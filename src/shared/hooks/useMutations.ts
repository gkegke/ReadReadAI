import { useMutation } from '@tanstack/react-query';
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository';

export const useImportDocumentMutation = () => {
    return useMutation({
        mutationFn: (file: File) => ProjectRepository.importDocument(file),
        onError: (err) => console.error('[Mutation] Import Document Failed', err),
    });
};

export const useImportTextMutation = () => {
    return useMutation({
        mutationFn: (text: string) => ProjectRepository.importRawText(text),
        onError: (err) => console.error('[Mutation] Import Text Failed', err),
    });
};

export const useInsertBlockMutation = () => {
    return useMutation({
        mutationFn: async ({ text, projectId, afterOrderIndex, role }: { text: string, projectId: number, afterOrderIndex: number, role: 'heading'|'paragraph' }) => {
             return ChunkRepository.insertBlock(text, projectId, afterOrderIndex, role);
        },
        onError: (err) => console.error('[Mutation] Insert Block Failed', err),
    });
};

export const useUpdateChunkTextMutation = () => {
    return useMutation({
        mutationFn: ({ id, text }: { id: number, text: string }) => 
            ChunkRepository.updateText(id, text),
    });
};

export const useGenerateAudioMutation = () => {
    return useMutation({
        mutationFn: (id: number) => ProjectRepository.generateChunkAudio(id),
    });
};

export const useSplitChunkMutation = () => {
    return useMutation({
        mutationFn: async ({ id, cursor }: { id: number, cursor: number }) => {
             return ChunkRepository.splitChunk(id, cursor);
        },
        onError: (err) => console.error('[Mutation] Split Chunk Failed', err),
    });
};

export const useMergeChunkMutation = () => {
    return useMutation({
        mutationFn: (id: number) => ChunkRepository.mergeWithNext(id),
        onError: (err) => console.error('[Mutation] Merge Chunk Failed', err),
    });
};

export const useDeleteChunksMutation = () => {
    return useMutation({
        mutationFn: ({ projectId, chunkIds }: { projectId: number, chunkIds: number[] }) => 
            ChunkRepository.deleteChunks(projectId, chunkIds),
        onError: (err) => console.error('[Mutation] Delete Chunks Failed', err),
    });
};

export const useRegenerateChunksMutation = () => {
    return useMutation({
        mutationFn: ({ projectId, chunkIds }: { projectId: number, chunkIds: number[] }) => 
            ChunkRepository.bulkRegenerate(projectId, chunkIds),
        onError: (err) => console.error('[Mutation] Regenerate Chunks Failed', err),
    });
};

export const useQueueMissingChunksMutation = () => {
    return useMutation({
        mutationFn: ({ projectId, fromOrderIndex = 0 }: { projectId: number, fromOrderIndex?: number }) => 
            ChunkRepository.queueMissing(projectId, fromOrderIndex),
        onError: (err) => console.error('[Mutation] Queue Missing Failed', err),
    });
};