import { PROMPT_VERSION, buildModelMessages } from "./prompt.js";
import { ENGINE_VERSION, RULE_VERSION } from "../risk/constants.js";
import type { AnswerAuditRepository } from "./monitoring-ports.js";
import type { TradeAssessmentService } from "./trade-assessment-service.js";
import type { MemoryRepository } from "./memory-ports.js";
import type {
  ConversationRepository,
  KnowledgeRetriever,
  ModelProvider,
  UsageRepository,
} from "./ports.js";
import type { ChatReply, Subscriber } from "./types.js";

export interface ChatInput {
  subscriber: Subscriber;
  text: string;
  requestId: string;
}

export interface CompanionOptions {
  historyLimit: number;
  knowledgeLimit: number;
  maxOutputTokens: number;
  provider?: string;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  knowledgeVersion?: string;
}

export class CompanionService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly knowledge: KnowledgeRetriever,
    private readonly model: ModelProvider,
    private readonly usage: UsageRepository,
    private readonly options: CompanionOptions,
    private readonly audit?: AnswerAuditRepository,
    private readonly assessments?: TradeAssessmentService,
    private readonly memory?: MemoryRepository,
  ) {}

  async reply(input: ChatInput): Promise<ChatReply> {
    const startedAt = Date.now();
    const question = input.text.trim();
    if (!question) throw new Error("Message text is empty.");
    if (question.length > 8000) throw new Error("Message exceeds the 8,000-character limit.");

    const conversation = await this.conversations.loadRecent(
      input.subscriber.id,
      input.subscriber.interfaceKind,
      this.options.historyLimit,
    );
    await this.conversations.appendMessage(
      conversation.conversationId,
      input.subscriber.id,
      "user",
      question,
    );

    const assessment = this.assessments
      ? await this.assessments.analyze(question, conversation.turns)
      : null;
    const memoryContext = await this.memory?.activeContext(input.subscriber.id).catch(() => null);
    let assessmentCostUsd = 0;
    if (assessment?.usage) {
      assessmentCostUsd =
        (assessment.usage.inputTokens / 1_000_000) *
          (this.options.inputCostPerMillionUsd ?? 0) +
        (assessment.usage.outputTokens / 1_000_000) *
          (this.options.outputCostPerMillionUsd ?? 0);
      await this.usage.record({
        subscriberId: input.subscriber.id,
        model: assessment.usage.model,
        provider: assessment.usage.provider,
        usageType: "assessment",
        inputTokens: assessment.usage.inputTokens,
        outputTokens: assessment.usage.outputTokens,
        estimatedCostUsd: assessmentCostUsd,
        requestId: `${input.requestId}-assessment`,
      });
    }
    const sources = await this.knowledge.search(question, this.options.knowledgeLimit);
    const result = await this.model.complete({
      messages: buildModelMessages(
        question,
        conversation.turns,
        sources,
        assessment?.context,
        memoryContext,
      ),
      maxOutputTokens: this.options.maxOutputTokens,
    });

    const modelAnswer = result.text.trim();
    if (!modelAnswer) throw new Error("The model returned an empty answer.");
    const answer = assessment
      ? `Deterministic assessment: ${assessment.status}\n\n${modelAnswer}`
      : modelAnswer;

    await this.conversations.appendMessage(
      conversation.conversationId,
      input.subscriber.id,
      "assistant",
      answer,
    );
    const estimatedCostUsd =
      (result.inputTokens / 1_000_000) * (this.options.inputCostPerMillionUsd ?? 0) +
      (result.outputTokens / 1_000_000) * (this.options.outputCostPerMillionUsd ?? 0);
    await this.usage.record({
      subscriberId: input.subscriber.id,
      model: result.model,
      provider: this.options.provider ?? "deepseek",
      usageType: "chat",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd,
      requestId: input.requestId,
    });
    await this.audit?.record({
      subscriberId: input.subscriber.id,
      requestId: input.requestId,
      question,
      answer,
      model: result.model,
      provider: this.options.provider ?? "deepseek",
      sourceIds: sources.map((source) => source.id),
      promptVersion: PROMPT_VERSION,
      knowledgeVersion: this.options.knowledgeVersion ?? "release-candidate-1.0",
      ruleEngineVersion: `${ENGINE_VERSION}/${RULE_VERSION}`,
      ...(assessment
        ? {
            ruleAssessment: assessment.assessment ?? { status: assessment.status },
          }
        : {}),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: estimatedCostUsd + assessmentCostUsd,
      latencyMs: Date.now() - startedAt,
    }).catch(() => undefined);

    return { text: answer, sources };
  }
}
