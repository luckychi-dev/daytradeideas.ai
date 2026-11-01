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

export const authStatusSchema = z.object({
  state: z.enum(["active", "verification_required", "awaiting_otp", "inactive"]),
});

export const chatSchema = z.object({
  text: z.string().min(1),
  sources: z.array(sourceSchema),
});

export const voiceSchema = chatSchema.extend({
  transcript: z.string().min(1),
  transcriptionModel: z.string().min(1),
});

export const supportSchema = chatSchema.extend({
  plans: z.array(planSchema),
});

export const verifySchema = z.object({
  verified: z.literal(true),
  active: z.boolean(),
  support: supportSchema.optional(),
});
