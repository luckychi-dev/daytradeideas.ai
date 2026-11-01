import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { XaiPrepaidBalance } from "../domain/admin-types.js";
import type { RuntimeSettingsRepository } from "../domain/ports.js";
import type { RuntimeSettings } from "../domain/usage-types.js";
import type { SubscriptionReconciler } from "../domain/subscription-reconciler.js";
import type { RetentionService } from "../domain/retention-service.js";
import type { FeedbackRepository } from "../domain/feedback-ports.js";
import { registerAdminRoutes } from "./admin-route.js";

const token = "a".repeat(32);
const settings: RuntimeSettings = {
  monthlyBudgetUsd: 20,
  dailyMessagesPerSubscriber: 60,
  dailyVoiceSecondsPerSubscriber: 600,
  tradeAssessmentEnabled: true,
  memoryEnabled: false,
  messageRetentionDays: 365,
};

function setup(balance: XaiPrepaidBalance | null = null) {
  const repository: AdminRepository = {
    overview: async () => ({ subscribers: 3, activeSubscribers: 1 } as never),
    listSubscribers: async () => [],
    updateSubscriberStatus: async () => {},
    unlinkSubscriber: async () => {},
    deleteSubscriber: async () => {},
    listAnswers: async () => [],
    listUsage: async () => [],
    listKnowledge: async () => [],
    approveChunk: async () => {},
    audit: vi.fn(async () => {}),
    listAudit: async () => [],
    listSubscriptionEvents: async () => [],
    analyzeAnswers: async (periodDays) => ({
      periodDays,
      totalAnswers: 0,
      assessedAnswers: 0,
      totalCostUsd: 0,
      averageLatencyMs: 0,
      maxLatencyMs: 0,
      byAssessmentStatus: [],
      failedRules: [],
      byProvider: [],
      topSources: [],
    }),
  };
  const settingsRepository: RuntimeSettingsRepository = {
    get: async () => settings,
    update: vi.fn(async () => {}),
  };
  const reconciler: SubscriptionReconciler = {
    reconcile: async () => ({ checked: 0, active: 0, inactive: 0, failed: 0 }),
  } as SubscriptionReconciler;
  const retention: RetentionService = {
    run: async () => ({ cutoff: new Date().toISOString(), messages: 0, answers: 0 }),
  } as RetentionService;
  const feedback: FeedbackRepository = {
    create: async () => {},
    list: async () => [],
    updateStatus: async () => {},
  };
  const app = Fastify();
  const ready = registerAdminRoutes(app, {
    adminToken: token,
    repository,
    settings: settingsRepository,
    reconciler,
    retention,
    integrationStatus: async () => ({ deepseekConfigured: true }),
    feedback,
    xaiBilling: { getPrepaidBalance: async () => balance },
    knowledgeAdmin: {
      list: async () => [],
      get: async () => { throw new Error("not implemented"); },
      create: async () => { throw new Error("not implemented"); },
      update: async () => { throw new Error("not implemented"); },
      delete: async () => { throw new Error("not implemented"); },
    },
  });
  return { app, ready, repository, settingsRepository };
}

describe("admin routes", () => {
  it("rejects missing admin credentials", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({ method: "GET", url: "/v1/admin/overview" });
    expect(response.statusCode).toBe(401);
  });

  it("returns monitoring data with a valid token", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/overview",
      headers: { "x-admin-token": token },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ subscribers: 3 });
  });

  it("updates configuration and records an audit event", async () => {
    const { app, ready, repository, settingsRepository } = setup();
    await ready;
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/admin/settings",
      headers: { "x-admin-token": token },
      payload: { monthlyBudgetUsd: 25, memoryEnabled: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ monthlyBudgetUsd: 25 });
    expect(settingsRepository.update).toHaveBeenCalled();
    expect(repository.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.updated" }),
    );
  });

  it("returns aggregate analysis for the admin dashboard", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/analysis?days=7",
      headers: { "x-admin-token": token },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ periodDays: 7, totalAnswers: 0 });
  });

  it("returns the xAI prepaid balance for the dashboard", async () => {
    const { app, ready } = setup({
      availableUsd: 10,
      currency: "USD",
      checkedAt: "2026-11-01T09:00:00.000Z",
    });
    await ready;
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/xai-balance",
      headers: { "x-admin-token": token },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      configured: true,
      availableUsd: 10,
      currency: "USD",
    });
  });
});
