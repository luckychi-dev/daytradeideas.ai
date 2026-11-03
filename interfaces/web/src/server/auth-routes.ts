import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthRateLimiterPort } from "./auth-rate-limit.js";
import type { WebBackendPort, VerifyResult } from "./backend-client.js";
import { sendFailure } from "./route-error.js";
import { sessionFor } from "./route-session.js";
import { resolveSession, sessionCookie } from "./session.js";

const emailSchema = z.object({
  email: z.string().trim().email().max(254),
});
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export interface WebAuthRouteDependencies {
  backend: WebBackendPort;
  sessionSecret: string;
  secureCookie: boolean;
  authLimiter: AuthRateLimiterPort;
}

export async function registerWebAuthRoutes(
  app: FastifyInstance,
  dependencies: WebAuthRouteDependencies,
): Promise<void> {
  const identityFor = (cookie: string | undefined, reply: Parameters<typeof sendFailure>[0]) =>
    sessionFor(
      dependencies.sessionSecret,
      dependencies.secureCookie,
      cookie,
      reply,
    );

  async function finishVerification(
    result: VerifyResult,
    cookie: string | undefined,
    reply: Parameters<typeof sendFailure>[0],
  ): Promise<VerifyResult> {
    if (result.active) return result;
    const identity = identityFor(cookie, reply);
    const support = await dependencies.backend.supportChat(
      identity,
      "Show all available membership plans and explain how to subscribe.",
      randomUUID(),
    ).catch(() => undefined);
    return { ...result, ...(support ? { support } : {}) };
  }

  app.post("/api/auth/request-code", async (request, reply) => {
    const body = emailSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_email" });
    const limit = dependencies.authLimiter.consume(`auth:${request.ip}`);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      return reply.code(429).send({ error: "verification_rate_limited" });
    }
    const identity = identityFor(request.headers.cookie, reply);
    try {
      await dependencies.backend.requestCode(identity, body.data.email);
      return { accepted: true };
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/auth/verify-code", async (request, reply) => {
    const body = codeSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_code" });
    const limit = dependencies.authLimiter.consume(`auth:${request.ip}`);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      return reply.code(429).send({ error: "verification_rate_limited" });
    }
    const identity = identityFor(request.headers.cookie, reply);
    try {
      const result = await dependencies.backend.verifyCode(identity, body.data.code);
      return await finishVerification(result, request.headers.cookie, reply);
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/auth/claim-account", async (request, reply) => {
    const identity = identityFor(request.headers.cookie, reply);
    try {
      const result = await dependencies.backend.claimAccount(identity);
      return await finishVerification(result, request.headers.cookie, reply);
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/logout", async (request, reply) => {
    const identity = identityFor(request.headers.cookie, reply);
    try {
      await dependencies.backend.unbind(identity);
      const replacement = resolveSession(undefined, dependencies.sessionSecret);
      reply.header(
        "set-cookie",
        sessionCookie(replacement.cookieValue, dependencies.secureCookie),
      );
      return { loggedOut: true };
    } catch (error) {
      return sendFailure(reply, error);
    }
  });
}
