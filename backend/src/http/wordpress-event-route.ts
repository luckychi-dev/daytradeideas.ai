import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SubscriptionEventRepository } from "../domain/ports.js";

const eventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string().min(1).max(100),
  wordpress_user_id: z.number().int().positive(),
  active: z.boolean(),
  active_memberships: z.array(z.object({
    id: z.number().int(),
    plan_id: z.number().int(),
    status: z.literal("wcm-active"),
    end_date: z.number().int().nullable(),
  })),
  occurred_at: z.string().datetime({ offset: true }),
}).passthrough();

function validSignature(request: FastifyRequest, secret: string): boolean {
  const timestamp = request.headers["x-dtiai-timestamp"];
  const nonce = request.headers["x-dtiai-nonce"];
  const signature = request.headers["x-dtiai-signature"];
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) return false;
  if (typeof nonce !== "string" || nonce.length < 16) return false;
  if (typeof signature !== "string" || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  if (!request.rawBody) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}\n${nonce}\n${request.rawBody}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export async function registerWordPressEventRoute(
  app: FastifyInstance,
  events: SubscriptionEventRepository,
  secret: string | undefined,
): Promise<void> {
  app.post("/v1/integrations/wordpress/membership", async (request, reply) => {
    if (!secret || !validSignature(request, secret)) {
      return reply.code(401).send({ error: "invalid_signature" });
    }
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_event" });
    const event = parsed.data;
    await events.apply({
      eventId: event.event_id,
      eventType: event.event_type,
      wordpressUserId: event.wordpress_user_id,
      active: event.active,
      memberships: event.active_memberships.map((membership) => ({
        id: membership.id,
        planId: membership.plan_id,
        status: membership.status,
        endDate: membership.end_date,
      })),
      occurredAt: new Date(event.occurred_at),
      payload: event,
    });
    return reply.code(202).send({ accepted: true });
  });
}

export { validSignature };
