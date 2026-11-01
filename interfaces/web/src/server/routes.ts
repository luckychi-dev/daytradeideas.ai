import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  BackendApiError,
  type WebBackendPort,
  type WebIdentity,
} from "./backend-client.js";
import type { AuthRateLimiterPort } from "./auth-rate-limit.js";
import { resolveSession, sessionCookie } from "./session.js";

const emailSchema = z.object({
  email: z.string().trim().email().max(254),
});
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
const chatSchema = z.object({
  text: z.string().trim().min(1).max(8000),
});
const voiceSchema = z.object({
  audioBase64: z.string().min(1).max(9_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  mimeType: z.enum([
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/opus",
  ]),
  durationSeconds: z.number().int().positive().max(600),
});
const imageSchema = z.object({
  imageBase64: z.string().min(1).max(9_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  text: z.string().trim().max(8000).optional(),
});

export interface WebRouteDependencies {
  backend: WebBackendPort;
  sessionSecret: string;
  secureCookie: boolean;
  telegramBotUrl: string;
  authLimiter: AuthRateLimiterPort;
}

function sessionFor(
  dependencies: WebRouteDependencies,
  cookieHeader: string | undefined,
  reply: FastifyReply,
) {
  const session = resolveSession(cookieHeader, dependencies.sessionSecret);
  reply.header("set-cookie", sessionCookie(session.cookieValue, dependencies.secureCookie));
  return session.identity;
}

async function sendFailure(reply: FastifyReply, error: unknown) {
  if (error instanceof BackendApiError) {
    return reply.code(error.status).send({ error: error.code });
  }
  return reply.code(503).send({ error: "mentor_unavailable" });
}

async function activeIdentity(
  dependencies: WebRouteDependencies,
  cookieHeader: string | undefined,
  reply: FastifyReply,
): Promise<WebIdentity> {
  const identity = sessionFor(dependencies, cookieHeader, reply);
  if (await dependencies.backend.authStatus(identity) !== "active") {
    throw new BackendApiError(403, "subscriber_not_allowed");
  }
  return identity;
}

export async function registerWebRoutes(
  app: FastifyInstance,
  dependencies: WebRouteDependencies,
): Promise<void> {
  app.get("/api/session", async (request, reply) => {
    const identity = sessionFor(dependencies, request.headers.cookie, reply);
    try {
      return {
        state: await dependencies.backend.authStatus(identity),
        telegramBotUrl: dependencies.telegramBotUrl,
      };
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/auth/request-code", async (request, reply) => {
    const body = emailSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_email" });
    const limit = dependencies.authLimiter.consume(`auth:${request.ip}`);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      return reply.code(429).send({ error: "verification_rate_limited" });
    }
    const identity = sessionFor(dependencies, request.headers.cookie, reply);
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
    const identity = sessionFor(dependencies, request.headers.cookie, reply);
    try {
      const result = await dependencies.backend.verifyCode(identity, body.data.code);
      if (result.active) return result;
      const support = await dependencies.backend.supportChat(
        identity,
        "Show all available membership plans and explain how to subscribe.",
        randomUUID(),
      ).catch(() => undefined);
      return { ...result, ...(support ? { support } : {}) };
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/logout", async (request, reply) => {
    const identity = sessionFor(dependencies, request.headers.cookie, reply);
    try {
      await dependencies.backend.unbind(identity);
      const replacement = resolveSession(undefined, dependencies.sessionSecret);
      reply.header("set-cookie", sessionCookie(replacement.cookieValue, dependencies.secureCookie));
      return { loggedOut: true };
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/chat", async (request, reply) => {
    const body = chatSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_message" });
    const identity = sessionFor(dependencies, request.headers.cookie, reply);
    try {
      const requestId = randomUUID();
      const state = await dependencies.backend.authStatus(identity);
      return state === "active"
        ? await dependencies.backend.chat(identity, body.data.text, requestId)
        : await dependencies.backend.supportChat(identity, body.data.text, requestId);
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/voice-chat", { bodyLimit: 9 * 1024 * 1024 }, async (request, reply) => {
    const body = voiceSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_voice" });
    try {
      const identity = await activeIdentity(
        dependencies,
        request.headers.cookie,
        reply,
      );
      return await dependencies.backend.chatVoice(
        identity,
        body.data.audioBase64,
        body.data.mimeType,
        body.data.durationSeconds,
        randomUUID(),
      );
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post("/api/image-chat", { bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
    const body = imageSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_image" });
    try {
      const identity = await activeIdentity(
        dependencies,
        request.headers.cookie,
        reply,
      );
      return await dependencies.backend.chatImage(identity, {
        base64: body.data.imageBase64,
        mimeType: body.data.mimeType,
        ...(body.data.text ? { text: body.data.text } : {}),
      }, randomUUID());
    } catch (error) {
      return sendFailure(reply, error);
    }
  });
}
