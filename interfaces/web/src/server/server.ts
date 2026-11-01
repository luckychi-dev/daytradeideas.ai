import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { WebBackendClient } from "./backend-client.js";
import type { AuthRateLimiterPort } from "./auth-rate-limit.js";
import { registerWebRoutes } from "./routes.js";

export interface WebServerOptions {
  backend: WebBackendClient;
  sessionSecret: string;
  secureCookie: boolean;
  telegramBotUrl: string;
  webPublicUrl: string;
  staticRoot?: string;
  authLimiter: AuthRateLimiterPort;
}

export function buildWebServer(options: WebServerOptions): FastifyInstance {
  const publicOrigin = new URL(options.webPublicUrl).origin;
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.cookie", "req.headers.x-service-token"],
    },
    bodyLimit: 64 * 1024,
    trustProxy: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    const origin = request.headers.origin;
    if (origin && origin !== publicOrigin) {
      return reply.code(403).send({ error: "origin_not_allowed" });
    }
    if (origin) {
      reply.header("access-control-allow-origin", publicOrigin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
      reply.header("access-control-allow-headers", "content-type");
      reply.header("access-control-max-age", "600");
      reply.header("vary", "Origin");
    }
    if (request.method === "OPTIONS") return reply.code(204).send();
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("permissions-policy", "camera=(), geolocation=(), microphone=(self)");
    reply.header("x-frame-options", "DENY");
    reply.header(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    if (request.url.startsWith("/api/")) reply.header("cache-control", "no-store");
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.register(registerWebRoutes, {
    backend: options.backend,
    sessionSecret: options.sessionSecret,
    secureCookie: options.secureCookie,
    telegramBotUrl: options.telegramBotUrl,
    authLimiter: options.authLimiter,
  });

  if (options.staticRoot && existsSync(options.staticRoot)) {
    app.register(fastifyStatic, {
      root: options.staticRoot,
      prefix: "/",
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}
