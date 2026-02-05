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

export const ChunkSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  orderInProject: z.number(),
  textContent: z.string(),
  cleanTextHash: z.string(), 
  status: ChunkStatusSchema.default('pending'),
  
  // Phase 3: Per-Cell Experimentation
  // Allows this specific chunk to override project defaults
  voiceOverride: z.object({
    voiceId: z.string().optional(),
    speed: z.number().optional(),
  }).optional(),

  noteContent: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Types inferred from Zod
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ChunkStatus = z.infer<typeof ChunkStatusSchema>;