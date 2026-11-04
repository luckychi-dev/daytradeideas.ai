import { z } from "zod";

const sourceSchema = z.object({
  sourceId: z.string(),
  sourceTitle: z.string(),
  sourceVersion: z.string(),
  locator: z.string(),
});

const planSchema = z.object({
  productId: z.number().int(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  billingPeriod: z.string(),
  billingInterval: z.number().int(),
  purchaseUrl: z.string().url(),
});

export const chatResponseSchema = z.object({
  text: z.string().min(1),
  sources: z.array(sourceSchema),
});

export const accessResponseSchema = z.object({
  allowed: z.boolean(),
  subscriberId: z.string().optional(),
});

export const voiceResponseSchema = chatResponseSchema.extend({
  transcript: z.string().min(1),
  transcriptionModel: z.string().min(1),
});

export const speechResponseSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.enum(["audio/ogg", "audio/opus", "audio/wav"]),
  model: z.string().min(1),
  voiceId: z.string().min(1),
  durationSeconds: z.number().int().positive(),
});

export const supportResponseSchema = chatResponseSchema.extend({
  plans: z.array(planSchema),
});

export const authStatusSchema = z.object({
  state: z.enum(["active", "verification_required", "awaiting_otp", "inactive"]),
});

export const verifyResultSchema = z.object({
  verified: z.literal(true),
  active: z.boolean(),
});
