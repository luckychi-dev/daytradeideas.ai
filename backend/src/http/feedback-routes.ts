import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessService } from "../domain/access-service.js";
import type { FeedbackRepository } from "../domain/feedback-ports.js";
import type { SubscriberIdentity } from "../domain/types.js";
import { identitySchema } from "./identity-schema.js";

export async function registerFeedbackRoutes(
  app: FastifyInstance,
  access: AccessService,
  feedback: FeedbackRepository,
): Promise<void> {
  app.post("/v1/internal/feedback", async (request, reply) => {
    const parsed = z.object({
      identity: identitySchema,
      requestId: z.string().max(200).nullable().optional(),
      category: z.enum(["helpful", "unclear", "incorrect", "safety", "other"]),
      message: z.string().min(1).max(2000),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await access.authorize(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    await feedback.create({
      subscriberId: subscriber.id,
      requestId: parsed.data.requestId ?? null,
      category: parsed.data.category,
      message: parsed.data.message,
    });
    return reply.code(202).send({ accepted: true });
  });
}

