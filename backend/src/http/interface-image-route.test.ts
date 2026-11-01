import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { AccessService } from "../domain/access-service.js";
import { CompanionService } from "../domain/companion-service.js";
import { RequestCoordinator } from "../domain/request-coordinator.js";
import type { Subscriber } from "../domain/types.js";
import { UsagePolicyService } from "../domain/usage-policy.js";
import { registerConversationRoutes } from "./conversation-routes.js";

const subscriber: Subscriber = {
  id: "subscriber-a",
  interfaceKind: "web",
  externalUserId: "web-user",
  displayName: "Test",
  status: "active",
  verifiedEmail: "member@example.com",
  wordpressUserId: 42,
  membershipStatus: "wcm-active",
  accessExpiresAt: null,
  lastVerifiedAt: new Date(),
};

const identity = { interfaceKind: "web", externalUserId: "web-user" };

async function setup() {
  const app = Fastify();
  const usage = {
    record: vi.fn(async () => {}),
    monthlySpendUsd: async () => 0,
    dailyUsage: async () => ({ requests: 0, voiceSeconds: 0 }),
  };
  const companion = new CompanionService(
    {
      loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
      appendMessage: async () => {},
    },
    { search: async () => [] },
    {
      complete: async () => ({
        text: "The screenshot shows a descending trendline.",
        model: "text-model",
        inputTokens: 20,
        outputTokens: 10,
      }),
    },
    usage,
    { historyLimit: 10, knowledgeLimit: 5, maxOutputTokens: 800 },
  );
  await registerConversationRoutes(app, {
    access: new AccessService(
      { isAllowed: () => true },
      { activate: async () => subscriber, findActive: async () => subscriber },
    ),
    companion,
    transcription: {
      transcribe: async () => ({ text: "voice", model: "transcription" }),
    },
    vision: {
      analyze: async () => ({
        text: "Visible gold chart with a descending trendline.",
        model: "vision-model",
        inputTokens: 100,
        outputTokens: 20,
      }),
    },
    usage,
    usagePolicy: new UsagePolicyService(
      {
        get: async () => ({
          monthlyBudgetUsd: 20,
          dailyMessagesPerSubscriber: 60,
          dailyVoiceSecondsPerSubscriber: 600,
          tradeAssessmentEnabled: false,
          memoryEnabled: false,
          messageRetentionDays: 365,
        }),
        update: async () => {},
      },
      usage,
    ),
    transcriptionProvider: "xai",
    transcriptionCostPerSecond: 0.1 / 3600,
    visionInputCostPerMillionUsd: 2,
    visionOutputCostPerMillionUsd: 6,
    requests: new RequestCoordinator({
      begin: async () => ({ status: "new" }),
      complete: async () => {},
      fail: async () => {},
    }),
  });
  return { app, usage };
}

describe("image conversation route", () => {
  it("converts chart pixels to evidence before answering with the mentor", async () => {
    const { app, usage } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/image-chat",
      payload: {
        identity,
        requestId: "image-1",
        imageBase64: Buffer.from("chart").toString("base64"),
        mimeType: "image/png",
        text: "What is visible here?",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      text: "The screenshot shows a descending trendline.",
      imageModel: "vision-model",
    });
    expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({
      usageType: "vision",
      model: "vision-model",
      requestId: "image-1-vision",
    }));
    await app.close();
  });
});
