import { describe, expect, it, vi } from "vitest";
import { CompanionService } from "./companion-service.js";
import type {
  ConversationRepository,
  KnowledgeRetriever,
  ModelProvider,
  RuntimeSettingsRepository,
} from "./ports.js";
import type { TradeExtractor } from "./trade-extractor.js";
import { TradeAssessmentService } from "./trade-assessment-service.js";
import type { Subscriber } from "./types.js";

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

const runtimeSettings: RuntimeSettingsRepository = {
  get: async () => ({
    monthlyBudgetUsd: 20,
    dailyMessagesPerSubscriber: 60,
    dailyVoiceSecondsPerSubscriber: 600,
    tradeAssessmentEnabled: true,
    memoryEnabled: false,
    messageRetentionDays: 365,
  }),
  update: async () => {},
};

const conversations: ConversationRepository = {
  loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
  appendMessage: async () => {},
};

function createService(
  extractor: TradeExtractor,
  model: ModelProvider,
): CompanionService {
  return new CompanionService(
    conversations,
    { search: async () => [] },
    model,
    { record: async () => {} },
    { historyLimit: 20, knowledgeLimit: 8, maxOutputTokens: 500 },
    undefined,
    new TradeAssessmentService(extractor, runtimeSettings),
  );
}

describe("CompanionService trade safety", () => {
  it("keeps a 1.4R trade verdict FAIL through the full mentor flow", async () => {
    const model = {
      complete: vi.fn<ModelProvider["complete"]>(async () => ({
        text: "The minimum reward-to-risk gate failed.",
        model: "test-model",
        inputTokens: 30,
        outputTokens: 10,
      })),
    };
    const extractor: TradeExtractor = {
      extract: async () => ({
        trade: {
          isTradeAssessment: true,
          direction: "long",
          entryPrice: 100,
          stopPrice: 90,
          targetPrices: [114],
          riskAllowance: 100,
          monetaryLossPerUnitAtStop: 10,
          positionUnitIncrement: 1,
          plannedPositionSize: null,
          remainingLossAllowance: { daily: 100, weekly: 200, monthly: 300 },
          stopOrderPlanned: true,
          noTradeConditionDisclosed: false,
          missingFields: [],
        },
        model: "test-extractor",
        provider: "deepseek",
        inputTokens: 20,
        outputTokens: 10,
      }),
    };
    const service = createService(extractor, model);

    const reply = await service.reply({
      subscriber,
      text: "Assess my 1.4R trade",
      requestId: "update-2",
    });

    expect(reply.text).toBe("The minimum reward-to-risk gate failed.");
    expect(model.complete.mock.calls[0]?.[0].messages).toContainEqual(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("No supplied target meets the 1.5:1 minimum"),
      }),
    );
  });

  it("stops safely when deterministic extraction fails", async () => {
    const model = { complete: vi.fn<ModelProvider["complete"]>() };
    const extractor: TradeExtractor = {
      extract: async () => { throw new Error("provider unavailable"); },
    };
    const service = createService(extractor, model);

    await expect(service.reply({
      subscriber,
      text: "Assess my trade",
      requestId: "update-3",
    })).rejects.toThrow("provider unavailable");
    expect(model.complete).not.toHaveBeenCalled();
  });
});
