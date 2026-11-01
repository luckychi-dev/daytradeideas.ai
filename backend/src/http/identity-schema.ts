import { z } from "zod";

export const identitySchema = z.object({
  interfaceKind: z.enum(["telegram", "web", "mobile", "whatsapp"]),
  externalUserId: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
});

export const accessSchema = z.object({ identity: identitySchema });

