import { describe, expect, it, vi } from "vitest";
import { CompanionService } from "./companion-service.js";
import type {
  ConversationRepository,
  KnowledgeRetriever,
  ModelProvider,
  UsageRepository,
} from "./ports.js";
import type { Subscriber } from "./types.js";
import type { TradeAssessmentService } from "./trade-assessment-service.js";
import type { TradeAssessmentOutcome } from "./trade-assessment-types.js";

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

describe("CompanionService", () => {
  it("binds every conversation write to the authorised subscriber", async () => {
    const appendMessage = vi.fn<ConversationRepository["appendMessage"]>(async () => {});
    const conversations: ConversationRepository = {
      loadRecent: async (subscriberId, interfaceKind, limit) => ({
        conversationId: `${subscriberId}-${interfaceKind}-${limit}`,
        turns: [{ role: "assistant", content: "Previous answer" }],
      }),
      appendMessage,
    };
    const knowledge: KnowledgeRetriever = {
      search: async () => [{
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Canonical rules",
        sourceVersion: "1.0",
        locator: "RISK-001",
        authorityLayer: "A",
        content: "Minimum reward-to-risk is 1.5:1.",
      }],
    };
    const model: ModelProvider = {
      complete: async (request) => ({
        text: request.messages.at(-1)?.content === "question"
          ? "grounded answer"
          : "unexpected",
        model: "test-model",
        inputTokens: 30,
        outputTokens: 10,
      }),
    };
    const record = vi.fn<UsageRepository["record"]>(async () => {});
    const service = new CompanionService(
      conversations,
      knowledge,
      model,
      { record },
      { historyLimit: 20, knowledgeLimit: 8, maxOutputTokens: 500 },
    );

    const reply = await service.reply({
      subscriber,
      text: "question",
      requestId: "update-1",
    });

    expect(reply.text).toBe("grounded answer");
    expect(appendMessage).toHaveBeenNthCalledWith(
      1,
      "subscriber-a-telegram-20",
      "subscriber-a",
      "user",
      "question",
    );
    expect(appendMessage).toHaveBeenNthCalledWith(
      2,
      "subscriber-a-telegram-20",
      "subscriber-a",
      "assistant",
      "grounded answer",
    );
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      subscriberId: "subscriber-a",
      requestId: "update-1",
      inputTokens: 30,
      outputTokens: 10,
    }));
  });

  it("waits for deterministic trade assessment before asking the model", async () => {
    let releaseAssessment!: (value: TradeAssessmentOutcome | null) => void;
    const assessmentGate = new Promise<TradeAssessmentOutcome | null>((resolve) => {
      releaseAssessment = resolve;
    });
    const analyze = vi.fn(() => assessmentGate);
    const complete = vi.fn<ModelProvider["complete"]>(async () => ({
      text: "grounded answer",
      model: "test-model",
      inputTokens: 30,
      outputTokens: 10,
    }));
    const service = new CompanionService(
      {
        loadRecent: async () => ({ conversationId: "conversation-a", turns: [] }),
        appendMessage: async () => {},
      },
      { search: async () => [] },
      { complete },
      { record: async () => {} },
      { historyLimit: 20, knowledgeLimit: 8, maxOutputTokens: 500 },
      undefined,
      { analyze } as unknown as TradeAssessmentService,
    );

    const reply = service.reply({
      subscriber,
      text: "Review my trade",
      requestId: "assessment-1",
    });
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledOnce());
    expect(complete).not.toHaveBeenCalled();

    releaseAssessment({ status: "NEEDS_INPUT", context: "Status: NEEDS_INPUT" });
    await expect(reply).resolves.toMatchObject({ text: "grounded answer" });
    expect(complete).toHaveBeenCalledOnce();
  });

  it("starts approved-knowledge retrieval while conversation loading is pending", async () => {
    let releaseConversation!: () => void;
    const conversationGate = new Promise<void>((resolve) => {
      releaseConversation = resolve;
    });
    const search = vi.fn(async () => []);
    const service = new CompanionService(
      {
        loadRecent: async () => {
          await conversationGate;
          return { conversationId: "conversation-a", turns: [] };
        },
        appendMessage: async () => {},
      },
      { search },
      {
        complete: async () => ({
          text: "answer",
          model: "test-model",
          inputTokens: 1,
          outputTokens: 1,
        }),
      },
      { record: async () => {} },
      { historyLimit: 20, knowledgeLimit: 8, maxOutputTokens: 500 },
    );

    const reply = service.reply({
      subscriber,
      text: "Explain the risk rule",
      requestId: "parallel-1",
    });
    await vi.waitFor(() => expect(search).toHaveBeenCalledOnce());
    expect(conversationGate).toBeInstanceOf(Promise);
    releaseConversation();
    await expect(reply).resolves.toMatchObject({ text: "answer" });
  });

});
