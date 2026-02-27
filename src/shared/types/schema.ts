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

export const ChapterSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  name: z.string().min(1, "Chapter name is required"),
  orderInProject: z.number(),
  createdAt: z.date(),
});

export const ChunkStatusSchema = z.enum(['pending', 'processing', 'generated', 'failed_tts']);

export const ChunkSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  chapterId: z.number(), // [CRITICAL: EPIC 2] Required. Enforces strict hierarchy.
  orderInProject: z.number(),
  textContent: z.string(),
  status: ChunkStatusSchema.default('pending'),
  activeAssetId: z.number().nullable().optional(), 
  generatedFilePath: z.string().nullable().optional(),
  cleanTextHash: z.string(),
  waveformPeaks: z.array(z.number()).optional(),
  voiceOverride: z.object({
    voiceId: z.string().optional(),
    speed: z.number().optional(),
  }).optional(),
  noteContent: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const JobSchema = z.object({
    id: z.number().optional(),
    chunkId: z.number(),
    projectId: z.number(),
    status: z.enum(['pending', 'processing', 'failed']),
    priority: z.number().default(0),
    retryCount: z.number().default(0),
    createdAt: z.date(),
});

export const IngestWorkerSchema = {
    processFile: z.object({
        file: z.instanceof(File),
        projectId: z.number()
    }),
    processText: z.object({
        text: z.string(),
        projectId: z.number()
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
export type Chapter = z.infer<typeof ChapterSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ChunkStatus = z.infer<typeof ChunkStatusSchema>;
export type Job = z.infer<typeof JobSchema>;
export type LogSeverity = z.infer<typeof LogSeveritySchema>;
export type LogEntry = z.infer<typeof LogSchema>;