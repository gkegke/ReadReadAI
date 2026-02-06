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

export const AudioAssetSchema = z.object({
  id: z.number().optional(),
  textHash: z.string(), 
  voiceId: z.string(),
  speed: z.number(),
  modelId: z.string(),
  filePath: z.string(), 
  byteSize: z.number(),
  durationMs: z.number().optional(), 
  createdAt: z.date(),
});

export const ChunkSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  orderInProject: z.number(),
  textContent: z.string(),
  status: ChunkStatusSchema.default('pending'),
  activeAssetId: z.number().nullable().optional(), 
  voiceOverride: z.object({
    voiceId: z.string().optional(),
    speed: z.number().optional(),
  }).optional(),
  noteContent: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// --- NEW JOB SCHEMA ---
export const JobSchema = z.object({
    id: z.number().optional(),
    chunkId: z.number(),
    projectId: z.number(),
    status: z.enum(['pending', 'processing', 'failed']),
    priority: z.number().default(0), // Higher = sooner
    retryCount: z.number().default(0),
    createdAt: z.date(),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ChunkStatus = z.infer<typeof ChunkStatusSchema>;
export type AudioAsset = z.infer<typeof AudioAssetSchema>;
export type Job = z.infer<typeof JobSchema>;