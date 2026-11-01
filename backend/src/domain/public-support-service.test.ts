import { describe, expect, it, vi } from "vitest";
import type {
  ConversationRepository,
  ModelProvider,
  UsageRepository,
  WordPressBridge,
} from "./ports.js";
import { PublicSupportService } from "./public-support-service.js";
import type { MembershipPlan, Subscriber } from "./types.js";

const subscriber: Subscriber = {
  id: "subscriber-pending",
  interfaceKind: "web",
  externalUserId: "visitor",
  displayName: "Visitor",
  status: "pending",
  verifiedEmail: null,
  wordpressUserId: null,
  membershipStatus: null,
  accessExpiresAt: null,
  lastVerifiedAt: null,
};
const plan: MembershipPlan = {
  productId: 550,
  name: "Index signals",
  description: "S&P 500, Nasdaq and Dow Jones analysis.",
  price: 79,
  regularPrice: 79,
  salePrice: null,
  currency: "GBP",
  billingPeriod: "month",
  billingInterval: 1,
  purchaseUrl: "https://example.com/product/index-signals",
};

describe("PublicSupportService", () => {
  it("answers a pending visitor with the live plan catalog and records usage", async () => {
    const appendMessage = vi.fn<ConversationRepository["appendMessage"]>(async () => {});
    const conversations: ConversationRepository = {
      loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
      appendMessage,
    };
    const complete = vi.fn<ModelProvider["complete"]>(async () => ({
      text: "The index package is £79 per month.",
      model: "test",
      inputTokens: 100,
      outputTokens: 20,
    }));
    const usage: UsageRepository = {
      record: vi.fn(async () => {}),
      monthlySpendUsd: async () => 0,
      dailyUsage: async () => ({ requests: 0, voiceSeconds: 0 }),
    };
    const bridge = {
      plans: vi.fn(async () => [plan]),
    } as unknown as WordPressBridge;
    const service = new PublicSupportService(
      conversations,
      { complete },
      usage,
      bridge,
      {
        historyLimit: 20,
        maxOutputTokens: 500,
        provider: "deepseek",
        inputCostPerMillionUsd: 0.3,
        outputCostPerMillionUsd: 1.2,
      },
    );

    const reply = await service.reply({
      subscriber,
      text: "Which plan includes index signals?",
      requestId: "support-1",
    });

    expect(reply).toEqual({
      text: "The index package is £79 per month.",
      plans: [plan],
    });
    expect(complete.mock.calls[0]?.[0].messages[0]?.content).toContain(
      "https://example.com/product/index-signals",
    );
    expect(complete.mock.calls[0]?.[0].messages[0]?.content).toContain(
      "Never provide trading analysis",
    );
    expect(appendMessage).toHaveBeenCalledTimes(2);
    expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({
      subscriberId: "subscriber-pending",
      usageType: "chat",
      requestId: "support-1",
    }));
  });

  it("does not provide trading analysis without a subscription", async () => {
    const complete = vi.fn<ModelProvider["complete"]>();
    const service = new PublicSupportService(
      {
        loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
        appendMessage: async () => {},
      },
      { complete },
      {
        record: async () => {},
        monthlySpendUsd: async () => 0,
        dailyUsage: async () => ({ requests: 0, voiceSeconds: 0 }),
      },
      { plans: async () => [plan] } as unknown as WordPressBridge,
      {
        historyLimit: 20,
        maxOutputTokens: 500,
        provider: "deepseek",
        inputCostPerMillionUsd: 0.3,
        outputCostPerMillionUsd: 1.2,
      },
    );

    const reply = await service.reply({
      subscriber,
      text: "Should I buy gold at this entry with a 1.2R target?",
      requestId: "support-2",
    });

    expect(reply.text).toContain("Trading questions");
    expect(reply.plans).toEqual([plan]);
    expect(complete).not.toHaveBeenCalled();
  });
});
