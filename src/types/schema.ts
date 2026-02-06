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

// EPIC 1: New Entity for managing generated files (Takes)
export const AudioAssetSchema = z.object({
  id: z.number().optional(),
  
  // The Signature: These 4 fields define uniqueness
  textHash: z.string(), // Hashed text for quick lookup
  voiceId: z.string(),
  speed: z.number(),
  modelId: z.string(),

  // File Metadata
  filePath: z.string(), // OPFS path
  byteSize: z.number(),
  durationMs: z.number().optional(), // Future proofing
  
  createdAt: z.date(),
});

export const ChunkSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  orderInProject: z.number(),
  textContent: z.string(),
  
  status: ChunkStatusSchema.default('pending'),
  
  // EPIC 1: Link to the specific audio take currently selected
  activeAssetId: z.number().nullable().optional(), 

  voiceOverride: z.object({
    voiceId: z.string().optional(),
    speed: z.number().optional(),
  }).optional(),

  noteContent: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type ChunkStatus = z.infer<typeof ChunkStatusSchema>;
export type AudioAsset = z.infer<typeof AudioAssetSchema>;