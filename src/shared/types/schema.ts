import { z } from 'zod';

export const VoiceSettingsSchema = z.object({
  voiceId: z.string().default('af_heart'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

export const ProjectSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Project name is required"),
  sourceFileName: z.string().optional(),
  voiceSettings: VoiceSettingsSchema.default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ChunkStatusSchema = z.enum(['pending', 'processing', 'generated', 'failed_tts']);
export const ChunkRoleSchema = z.enum(['heading', 'paragraph']);

export const ChunkSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  role: ChunkRoleSchema.default('paragraph'),
  orderInProject: z.number(),
  textContent: z.string(),
  status: ChunkStatusSchema.default('pending'),
  generatedFilePath: z.string().nullable().optional(),
  cleanTextHash: z.string(),
  waveformPeaks: z.array(z.number()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const JobSchema = z.object({
    id: z.number().optional(),
    chunkId: z.number(),
    projectId: z.number(),
    status: z.enum(['pending', 'processing', 'failed']).default('pending'),
    priority: z.number().default(0),
    retryCount: z.number().default(0),
    createdAt: z.date(),
    updatedAt: z.date().optional(),
});

export const OrphanedFileSchema = z.object({
    id: z.number().optional(),
    path: z.string(),
    createdAt: z.date()
});

export const IngestWorkerSchema = {
    processFile: z.object({
        file: z.instanceof(File),
        projectId: z.number(),
        afterOrderIndex: z.number().optional()
    }),
    processText: z.object({
        text: z.string(),
        projectId: z.number(),
        afterOrderIndex: z.number().optional()
    })
};

export const TTSWorkerSchema = {
    initModel: z.object({
        modelId: z.string(),
        onProgress: z.function()
    }),
    generate: z.object({
        text: z.string(),
        config: z.object({
            voice: z.string(),
            speed: z.number(),
            lang: z.string()
        }),
        filepath: z.string()
    })
};

export const LogSeveritySchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export const LogSchema = z.object({
    id: z.number().optional(),
    timestamp: z.date(),
    severity: LogSeveritySchema,
    component: z.string(),
    message: z.string(),
    context: z.any().optional(),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ChunkRole = z.infer<typeof ChunkRoleSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ChunkStatus = z.infer<typeof ChunkStatusSchema>;
export type Job = z.infer<typeof JobSchema>;
export type OrphanedFile = z.infer<typeof OrphanedFileSchema>;
export type LogSeverity = z.infer<typeof LogSeveritySchema>;
export type LogEntry = z.infer<typeof LogSchema>;
