import type { FastifyInstance } from "fastify";
import type { XaiBillingPort } from "../domain/admin-ports.js";

export async function registerAdminBillingRoute(
  app: FastifyInstance,
  billing: XaiBillingPort,
): Promise<void> {
  app.get("/v1/admin/xai-balance", async (request, reply) => {
    try {
      const balance = await billing.getPrepaidBalance();
      if (!balance) {
        return {
          configured: false,
          availableUsd: null,
          currency: "USD",
          checkedAt: null,
        };
      }
      return { configured: true, ...balance };
    } catch (error) {
      request.log.error({ err: error }, "xAI prepaid balance lookup failed");
      return reply.code(502).send({
        configured: true,
        error: "xai_balance_unavailable",
      });
    }
  });
}
