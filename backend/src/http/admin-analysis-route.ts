import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
}).passthrough();

export async function registerAdminAnalysisRoute(
  app: FastifyInstance,
  repository: AdminRepository,
): Promise<void> {
  app.get("/v1/admin/analysis", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_period" });
    return repository.analyzeAnswers(query.data.days);
  });
}
