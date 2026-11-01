import { z } from "zod";

export const summarySchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  moduleCode: z.string(),
  authorityLayer: z.enum(["A", "B", "C", "D", "E", "F"]),
  chunkCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const documentSchema = summarySchema.extend({
  authorOrSpeaker: z.string().nullable(),
  contentType: z.string(),
  sourceFile: z.string().nullable(),
  topicTags: z.array(z.string()),
  content: z.string(),
  url: z.string(),
});

export const mutationSchema = z.object({
  title: z.string().trim().min(1).max(240),
  version: z.string().trim().min(1).max(40),
  moduleCode: z.string().trim().min(1).max(40),
  authorOrSpeaker: z.string().trim().min(1).max(160)
    .describe("Source author or speaker, usually Jason Sen / Day Trade Ideas."),
  authorityLayer: z.enum(["A", "B", "C", "D", "E", "F"])
    .describe("Knowledge authority. Use A only for canonical controls."),
  contentType: z.string().trim().min(1).max(80),
  topicTags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  content: z.string().trim().min(1).max(2_000_000),
});

export const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string(),
});

export const profileSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.literal("admin"),
});
