import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { RetentionService } from "../domain/retention-service.js";
import type { SubscriptionReconciler } from "../domain/subscription-reconciler.js";

export function installShutdown(app: FastifyInstance, pool: Pool): void {
  const shutdown = async (signal: string): Promise<void> => {
    console.info(`Received ${signal}; shutting down.`);
    await app.close();
    await pool.end();
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

export function startPeriodicJobs(
  reconciler: SubscriptionReconciler,
  retention: RetentionService,
  intervalMinutes: number,
): void {
  const reconcileTimer = setInterval(() => {
    void reconciler.reconcile().catch((error) => {
      console.warn(
        `Subscription reconciliation failed: ${
          error instanceof Error ? error.name : "UnknownError"
        }`,
      );
    });
  }, intervalMinutes * 60_000);
  reconcileTimer.unref();

  const retentionTimer = setInterval(() => {
    void retention.run().catch((error) => {
      console.warn(
        `Retention cleanup failed: ${error instanceof Error ? error.name : "UnknownError"}`,
      );
    });
  }, 24 * 60 * 60_000);
  retentionTimer.unref();
}
