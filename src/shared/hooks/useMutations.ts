import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectRepository } from '../../features/library/api/ProjectRepository';
import { ChunkRepository } from '../../features/studio/api/ChunkRepository';

/**
 * Hook to import a PDF/File into the active project.
 */
export const useImportDocumentMutation = () => {
    return useMutation({
        mutationFn: (file: File) => ProjectRepository.importDocument(file),
        onError: (err) => console.error('[Mutation] Import Document Failed', err),
    });
};

/**
 * Hook to import raw text into the project as new chunks.
 */
export const useImportTextMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (text: string) => ProjectRepository.importRawText(text),
        onSuccess: () => {
            // Note: Data reactivity still primarily handled by useLiveQuery, 
            // but we can trigger additional logic here if needed.
        },
        onError: (err) => console.error('[Mutation] Import Text Failed', err),
    });
};

/**
 * Hook to update a chunk's content (triggers re-synthesis).
 */
export const useUpdateChunkTextMutation = () => {
    return useMutation({
        mutationFn: ({ id, text }: { id: number, text: string }) => 
            ChunkRepository.updateText(id, text),
    });
};

/**
 * Manually trigger audio generation for a specific chunk.
 */
export const useGenerateAudioMutation = () => {
    return useMutation({
        mutationFn: (id: number) => ProjectRepository.generateChunkAudio(id),
    });
};

/**
 * Split a chunk into two at a specific character cursor.
 */
export const useSplitChunkMutation = () => {
    return useMutation({
        mutationFn: async ({ id, cursor }: { id: number, cursor: number }) => {
             // Implementation pending in ProjectRepository
             console.log("Split not yet implemented", id, cursor);
        }
    });
};