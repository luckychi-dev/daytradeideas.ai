import Fastify, { type FastifyInstance } from "fastify";
import type { TelegramHandler } from "./handler.js";
import { registerTelegramRoute } from "./webhook-route.js";

export function buildTelegramServer(
  handler: TelegramHandler,
  webhookSecret: string,
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: [
        "req.headers.x-telegram-bot-api-secret-token",
        "req.headers.x-service-token",
      ],
    },
    bodyLimit: 64 * 1024,
  });
  app.get("/health/live", async () => ({ status: "ok" }));
  app.register(async (instance) => {
    await registerTelegramRoute(instance, handler, webhookSecret);
  });
  return app;
}

