import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AccessService } from "../domain/access-service.js";
import { AuthService } from "../domain/auth-service.js";
import { CompanionService } from "../domain/companion-service.js";
import { RequestCoordinator } from "../domain/request-coordinator.js";
import type { Subscriber } from "../domain/types.js";
import { UsagePolicyService } from "../domain/usage-policy.js";
import { registerInterfaceRoutes } from "./interface-route.js";

const subscriber: Subscriber = {
  id: "subscriber-a",
  interfaceKind: "telegram",
  externalUserId: "123",
  displayName: "Test",
  status: "active",
  verifiedEmail: "test@example.com",
  wordpressUserId: 42,
  membershipStatus: "wcm-active",
  accessExpiresAt: null,
  lastVerifiedAt: new Date(),
};

function setup() {
  const app = Fastify();
  const access = new AccessService(
    { isAllowed: () => true },
    { activate: async () => subscriber, findActive: async () => subscriber },
  );
  const auth = new AuthService(
    { activate: async () => subscriber, ensure: async () => subscriber, find: async () => subscriber,
      findActive: async () => subscriber, linkAccess: async () => {}, unbind: async () => {},
      updateAccessByWordpressUserId: async () => {} },
    {
      save: async () => {},
      get: async () => null,
      clear: async () => {},
    },
    {
      requestCode: async () => {},
      plans: async () => [],
      verifyCode: async () => ({ valid: false, eligible: false, wordpressUserId: null,
        email: "test@example.com", memberships: [] }),
    },
  );
  const companion = new CompanionService(
    {
      loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
      appendMessage: async () => {},
    },
    { search: async () => [] },
    {
      complete: async () => ({
        text: "Grounded answer",
        model: "test",
        inputTokens: 10,
        outputTokens: 5,
      }),
    },
    { record: async () => {} },
    { historyLimit: 10, knowledgeLimit: 5, maxOutputTokens: 500 },
  );
  const transcription = { transcribe: async () => ({ text: "voice question", model: "test-transcription" }) };
  const vision = { analyze: async () => ({ text: "visible chart", model: "test-vision", inputTokens: 10, outputTokens: 5 }) };
  const usage = {
    record: async () => {},
    monthlySpendUsd: async () => 0,
    dailyUsage: async () => ({ requests: 0, voiceSeconds: 0 }),
  };
  const usagePolicy = new UsagePolicyService(
    {
      get: async () => ({
        monthlyBudgetUsd: 20,
        dailyMessagesPerSubscriber: 60,
        dailyVoiceSecondsPerSubscriber: 600,
        tradeAssessmentEnabled: true,
        memoryEnabled: false,
        messageRetentionDays: 365,
      }),
      update: async () => {},
    },
    usage,
  );
  return {
    app,
    ready: registerInterfaceRoutes(app, {
      access,
      auth,
      companion,
      support: { reply: async () => ({ text: "Support answer", plans: [] }) },
      transcription,
      vision,
      usage,
      usagePolicy,
      transcriptionProvider: "xai",
      transcriptionCostPerSecond: 0.1 / 3600,
      visionInputCostPerMillionUsd: 2, visionOutputCostPerMillionUsd: 6,
      requests: new RequestCoordinator({
        begin: async () => ({ status: "new" }),
        complete: async () => {},
        fail: async () => {},
      }),
      feedback: { create: async () => {}, list: async () => [], updateStatus: async () => {} },
      rateLimits: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
      serviceToken: "a".repeat(32),
    }),
  };
}

const identity = { interfaceKind: "telegram", externalUserId: "123" };

describe("internal interface API", () => {
  it("rejects calls without the service token", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/access",
      payload: { identity },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns an authorised subscriber and mentor answer", async () => {
    const { app, ready } = setup();
    await ready;
    const headers = { "x-service-token": "a".repeat(32) };
    const accessResponse = await app.inject({
      method: "POST",
      url: "/v1/internal/access",
      headers,
      payload: { identity },
    });
    const chatResponse = await app.inject({
      method: "POST",
      url: "/v1/internal/chat",
      headers,
      payload: { identity, text: "question", requestId: "update-1" },
    });
    expect(accessResponse.statusCode).toBe(200);
    expect(accessResponse.json()).toEqual({ allowed: true, subscriberId: "subscriber-a" });
    expect(chatResponse.statusCode).toBe(200);
    expect(chatResponse.json()).toEqual({ text: "Grounded answer", sources: [] });
  });

  it("returns deterministic risk gates through the backend contract", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/risk-assess",
      headers: { "x-service-token": "a".repeat(32) },
      payload: {
        identity,
        trade: {
          direction: "long",
          entryPrice: 100,
          stopPrice: 90,
          targetPrices: [115, 120],
          riskAllowance: 100,
          monetaryLossPerUnitAtStop: 10,
          positionUnitIncrement: 1,
          remainingLossAllowance: { daily: 100, weekly: 200, monthly: 300 },
          stopOrderPlanned: true,
          noTradeConditionDisclosed: false,
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      overallStatus: "PASS",
      calculations: { plannedMonetaryRisk: 100 },
    });
  });

  it("transcribes a voice note before running the mentor request", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/voice-chat",
      headers: { "x-service-token": "a".repeat(32) },
      payload: {
        identity,
        requestId: "voice-1",
        audioBase64: Buffer.from("audio").toString("base64"),
        mimeType: "audio/ogg",
        durationSeconds: 12,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      transcript: "voice question",
      transcriptionModel: "test-transcription",
      text: "Grounded answer",
    });
  });
});
