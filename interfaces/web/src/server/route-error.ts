import type { FastifyReply } from "fastify";
import { BackendApiError } from "./backend-client.js";

export async function sendFailure(reply: FastifyReply, error: unknown) {
  if (error instanceof BackendApiError) {
    return reply.code(error.status).send({ error: error.code });
  }
  return reply.code(503).send({ error: "mentor_unavailable" });
}
