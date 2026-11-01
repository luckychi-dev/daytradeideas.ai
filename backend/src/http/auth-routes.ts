import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AccessService } from "../domain/access-service.js";
import {
  AuthService,
  EmailAlreadyLinkedError,
  EmailMismatchError,
  InvalidVerificationError,
  SubscriptionInactiveError,
} from "../domain/auth-service.js";
import type { SubscriberIdentity } from "../domain/types.js";
import type { VerificationRateLimitRepository } from "../domain/ports.js";

const identitySchema = z.object({
  interfaceKind: z.enum(["telegram", "web", "mobile", "whatsapp"]),
  externalUserId: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
});
const requestSchema = z.object({
  identity: identitySchema,
  email: z.string().min(3).max(254),
});
const verifySchema = z.object({
  identity: identitySchema,
  code: z.string().regex(/^\d{6}$/),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  access: AccessService,
  auth: AuthService,
  rateLimits: VerificationRateLimitRepository,
): Promise<void> {
  async function enforceLimit(
    reply: FastifyReply,
    identity: SubscriberIdentity,
    action: "request_code" | "verify_code",
    limit: number,
  ): Promise<boolean> {
    const decision = await rateLimits.consume(
      identity.interfaceKind,
      identity.externalUserId,
      action,
      limit,
      900,
    );
    if (decision.allowed) return true;
    reply.header("retry-after", String(decision.retryAfterSeconds));
    await reply.code(429).send({ error: "verification_rate_limited" });
    return false;
  }

  app.post("/v1/internal/auth/status", async (request, reply) => {
    const parsed = z.object({ identity: identitySchema }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const identity = parsed.data.identity as SubscriberIdentity;
    if (await access.authorize(identity)) return { state: "active" };
    return { state: (await auth.status(identity)).state };
  });

  app.post("/v1/internal/auth/request-code", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_email" });
    const identity = parsed.data.identity as SubscriberIdentity;
    if (!await enforceLimit(reply, identity, "request_code", 5)) return;
    try {
      await auth.requestCode(identity, parsed.data.email);
      return { accepted: true };
    } catch (error) {
      if (error instanceof EmailMismatchError) {
        return reply.code(409).send({ error: "email_mismatch" });
      }
      if (error instanceof InvalidVerificationError) {
        return reply.code(400).send({ error: "invalid_email" });
      }
      request.log.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Verification code request failed.",
      );
      return reply.code(503).send({ error: "verification_unavailable" });
    }
  });

  app.post("/v1/internal/auth/verify-code", async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_code" });
    const identity = parsed.data.identity as SubscriberIdentity;
    if (!await enforceLimit(reply, identity, "verify_code", 10)) return;
    try {
      const subscriber = await auth.verifyCode(identity, parsed.data.code);
      return { verified: true, active: subscriber.status === "active" };
    } catch (error) {
      if (error instanceof EmailAlreadyLinkedError) {
        return reply.code(409).send({ error: "email_already_linked" });
      }
      if (error instanceof SubscriptionInactiveError) {
        return reply.code(403).send({ error: "subscription_inactive" });
      }
      if (error instanceof InvalidVerificationError) {
        return reply.code(401).send({ error: "invalid_code" });
      }
      request.log.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Subscription verification failed.",
      );
      return reply.code(503).send({ error: "verification_unavailable" });
    }
  });

  app.post("/v1/internal/unbind", async (request, reply) => {
    const parsed = z.object({ identity: identitySchema }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    await auth.unbind(parsed.data.identity as SubscriberIdentity);
    return { unbound: true };
  });
}
