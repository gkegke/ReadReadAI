import { useState, useCallback } from 'react';
import { ProjectRepository } from '../repositories/ProjectRepository';

/**
 * A lightweight alternative to TanStack's useMutation.
 * Provides isPending and error state for async repository actions.
 */
function useAsyncAction<TArgs extends any[], TResult>(
    actionFn: (...args: TArgs) => Promise<TResult>
) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutate = useCallback(async (...args: TArgs) => {
        setIsPending(true);
        setError(null);
        try {
            const result = await actionFn(...args);
            return result;
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            throw err;
        } finally {
            setIsPending(false);
        }
    }, [actionFn]);

    return { mutate, isPending, error };
}

export const useImportDocumentMutation = () => {
    return useAsyncAction((file: File) => ProjectRepository.importDocument(file));
};

export const useImportTextMutation = () => {
    return useAsyncAction((text: string) => ProjectRepository.importRawText(text));
};

export const useUpdateChunkTextMutation = () => {
    return useAsyncAction(({ id, text }: { id: number, text: string }) => 
        ProjectRepository.updateChunkText(id, text)
    );
};

export const useGenerateAudioMutation = () => {
    return useAsyncAction((id: number) => ProjectRepository.generateChunkAudio(id));
};

// Placeholder for remaining logic (split/merge)
export const useSplitChunkMutation = () => {
    return useAsyncAction(async ({ id, cursor }: { id: number, cursor: number }) => {
        console.log("Split not yet implemented in ProjectRepository", id, cursor);
    });
};

export const useMergeChunkMutation = () => {
    return useAsyncAction(async (id: number) => {
        console.log("Merge not yet implemented in ProjectRepository", id);
    });
};