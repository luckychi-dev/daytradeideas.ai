import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

export async function registerHealthRoutes(app: FastifyInstance, pool: Pool): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
}

