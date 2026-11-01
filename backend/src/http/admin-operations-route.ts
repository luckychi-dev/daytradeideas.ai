import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { RuntimeSettingsRepository } from "../domain/ports.js";
import type { RetentionService } from "../domain/retention-service.js";
import type { SubscriptionReconciler } from "../domain/subscription-reconciler.js";

const settingsSchema = z.object({
  monthlyBudgetUsd: z.number().positive().optional(),
  dailyMessagesPerSubscriber: z.number().int().positive().optional(),
  dailyVoiceSecondsPerSubscriber: z.number().int().nonnegative().optional(),
  tradeAssessmentEnabled: z.boolean().optional(),
  memoryEnabled: z.boolean().optional(),
  messageRetentionDays: z.number().int().positive().optional(),
});

export interface AdminOperationDependencies {
  repository: AdminRepository;
  settings: RuntimeSettingsRepository;
  reconciler: SubscriptionReconciler;
  retention: RetentionService;
  integrationStatus: () => Promise<Record<string, unknown>>;
}

export async function registerAdminOperationRoutes(
  app: FastifyInstance,
  deps: AdminOperationDependencies,
): Promise<void> {
  app.get("/v1/admin/integration-status", async () => deps.integrationStatus());

  app.get("/v1/admin/settings", async () => deps.settings.get());

  app.patch("/v1/admin/settings", async (request, reply) => {
    const patch = settingsSchema.safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: "invalid_settings" });
    const current = await deps.settings.get();
    const values = Object.fromEntries(
      Object.entries(patch.data).filter(([, value]) => value !== undefined),
    );
    const updated = { ...current, ...values } as typeof current;
    await deps.settings.update(updated, "admin-api");
    await deps.repository.audit({
      actor: "admin-api",
      action: "settings.updated",
      targetType: "runtime_settings",
      targetId: null,
      details: patch.data,
    });
    return updated;
  });

  app.post("/v1/admin/subscriptions/reconcile", async () => {
    const result = await deps.reconciler.reconcile();
    await deps.repository.audit({
      actor: "admin-api",
      action: "subscriptions.reconciled",
      targetType: "subscription",
      targetId: null,
      details: { ...result },
    });
    return result;
  });

  app.post("/v1/admin/retention/run", async () => {
    const result = await deps.retention.run();
    await deps.repository.audit({
      actor: "admin-api",
      action: "retention.completed",
      targetType: "retention",
      targetId: null,
      details: { ...result },
    });
    return result;
  });
}
