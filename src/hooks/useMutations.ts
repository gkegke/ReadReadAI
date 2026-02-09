import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectRepository } from '../repositories/ProjectRepository';

export const useImportDocumentMutation = () => {
    return useMutation({ mutationFn: (file: File) => ProjectRepository.importDocument(file) });
};

export const useImportTextMutation = () => {
    return useMutation({ mutationFn: (text: string) => ProjectRepository.importRawText(text) });
};

export const useUpdateChunkTextMutation = () => {
    return useMutation({
        mutationFn: ({ id, text }: { id: number, text: string }) => 
            ProjectRepository.updateChunkText(id, text)
    });
};

export const useSplitChunkMutation = () => {
    return useMutation({
        mutationFn: ({ id, cursor }: { id: number, cursor: number }) => 
            ProjectRepository.splitChunk(id, cursor)
    });
};

export const useMergeChunkMutation = () => {
    return useMutation({ mutationFn: (id: number) => ProjectRepository.mergeChunkWithNext(id) });
};

export const useInsertChunkMutation = () => {
    // Note: If project logic requires specific order, ProjectRepository handles it
    return useMutation({
        mutationFn: ({ id, text }: { id: number, text: string }) => 
            ProjectRepository.importRawText(text) // Or a specific insert method
    });
};

export const useGenerateAudioMutation = () => {
    return useMutation({ mutationFn: (id: number) => ProjectRepository.generateChunkAudio(id) });
};