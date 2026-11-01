import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { TelegramHandler } from "./handler.js";

function secretMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function registerTelegramRoute(
  app: FastifyInstance,
  handler: TelegramHandler,
  webhookSecret: string,
): Promise<void> {
  app.post("/webhooks/telegram", async (request, reply) => {
    const supplied = request.headers["x-telegram-bot-api-secret-token"];
    const token = Array.isArray(supplied) ? supplied[0] : supplied;
    if (!secretMatches(token, webhookSecret)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    await handler.handle(request.body);
    return reply.code(200).send({ ok: true });
  });
}

export { secretMatches };
