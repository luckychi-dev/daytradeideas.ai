import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessService } from "../domain/access-service.js";
import type { MemoryRepository } from "../domain/memory-ports.js";
import type { SubscriberIdentity } from "../domain/types.js";
import { MemoryDisabledError } from "../adapters/postgres/memory-repository.js";
import { identitySchema } from "./identity-schema.js";

const category = z.enum(["preference", "plan_setting", "learning_goal", "self_reported_habit"]);
const identityBody = z.object({ identity: identitySchema });
const itemBody = z.object({
  identity: identitySchema,
  category,
  content: z.string().min(1).max(1000),
  reviewAfter: z.string().date().nullable().optional(),
});

export async function registerMemoryRoutes(
  app: FastifyInstance,
  access: AccessService,
  memory: MemoryRepository,
): Promise<void> {
  const subscriberFor = async (identity: SubscriberIdentity) =>
    access.authorize(identity);

  app.post("/v1/internal/memory/status", async (request, reply) => {
    const parsed = identityBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    return {
      settings: await memory.settings(subscriber.id),
      items: await memory.items(subscriber.id),
    };
  });

  app.post("/v1/internal/memory/enable", async (request, reply) => {
    const parsed = identityBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    try {
      await memory.enable(subscriber.id, "memory-consent-v1");
      return { enabled: true };
    } catch (error) {
      if (error instanceof MemoryDisabledError) {
        return reply.code(409).send({ error: "memory_feature_disabled" });
      }
      throw error;
    }
  });

  app.post("/v1/internal/memory/disable", async (request, reply) => {
    const parsed = identityBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    await memory.disable(subscriber.id);
    return { enabled: false };
  });

  app.post("/v1/internal/memory/items", async (request, reply) => {
    const parsed = itemBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    try {
      return await memory.upsert({
        subscriberId: subscriber.id,
        category: parsed.data.category,
        content: parsed.data.content,
        origin: "subscriber_confirmed",
        reviewAfter: parsed.data.reviewAfter ?? null,
      });
    } catch (error) {
      if (error instanceof MemoryDisabledError) {
        return reply.code(409).send({ error: "memory_disabled" });
      }
      throw error;
    }
  });

  app.patch("/v1/internal/memory/items/:id", async (request, reply) => {
    const id = z.string().uuid().safeParse((request.params as { id?: string }).id);
    const parsed = itemBody.omit({ identity: true }).extend({
      identity: identitySchema,
    }).safeParse(request.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    try {
      return await memory.upsert({
        id: id.data,
        subscriberId: subscriber.id,
        category: parsed.data.category,
        content: parsed.data.content,
        origin: "subscriber_corrected",
        reviewAfter: parsed.data.reviewAfter ?? null,
      });
    } catch (error) {
      if (error instanceof MemoryDisabledError) {
        return reply.code(409).send({ error: "memory_disabled" });
      }
      throw error;
    }
  });

  app.delete("/v1/internal/memory/items/:id", async (request, reply) => {
    const id = z.string().uuid().safeParse((request.params as { id?: string }).id);
    const parsed = identityBody.safeParse(request.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    await memory.removeItem(subscriber.id, id.data);
    return { deleted: true };
  });

  app.delete("/v1/internal/memory", async (request, reply) => {
    const parsed = identityBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await subscriberFor(parsed.data.identity as SubscriberIdentity);
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    await memory.clear(subscriber.id);
    return { deleted: true, enabled: false };
  });
}
