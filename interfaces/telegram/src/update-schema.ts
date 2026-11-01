import { z } from "zod";

const userSchema = z.object({
  id: z.number().int(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const chatSchema = z.object({
  id: z.number().int(),
  type: z.string(),
});

export const messageSchema = z.object({
  message_id: z.number().int(),
  from: userSchema.optional(),
  chat: chatSchema,
  date: z.number().int(),
  text: z.string().max(12000).optional(),
  caption: z.string().max(2000).optional(),
  photo: z.array(z.object({
    file_id: z.string().min(1),
    file_unique_id: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    file_size: z.number().int().positive().optional(),
  })).max(20).optional(),
  document: z.object({
    file_id: z.string().min(1),
    file_unique_id: z.string(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
    file_size: z.number().int().positive().optional(),
  }).optional(),
  voice: z.object({
    file_id: z.string().min(1),
    file_unique_id: z.string(),
    duration: z.number().int().positive(),
    mime_type: z.string().optional(),
    file_size: z.number().int().positive().optional(),
  }).optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: messageSchema.optional(),
  callback_query: z.object({
    id: z.string().min(1),
    from: userSchema,
    data: z.string().max(200).optional(),
    message: messageSchema.optional(),
  }).optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
