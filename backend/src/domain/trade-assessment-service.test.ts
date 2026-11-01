import { describe, expect, it } from "vitest";
import type { RuntimeSettingsRepository } from "./ports.js";
import type { TradeExtractor } from "./trade-extractor.js";
import { TradeAssessmentService } from "./trade-assessment-service.js";
import type { ExtractedTrade } from "./trade-assessment-types.js";

const settings: RuntimeSettingsRepository = {
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

const completeTrade: ExtractedTrade = {
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
};

function extractor(trade: ExtractedTrade): TradeExtractor {
  return {
    extract: async () => ({
      trade,
      model: "test",
      provider: "deepseek",
      inputTokens: 10,
      outputTokens: 5,
    }),
  };
}

describe("TradeAssessmentService", () => {
  it("returns NEEDS_INPUT rather than guessing missing trade data", async () => {
    const service = new TradeAssessmentService(
      extractor({ ...completeTrade, entryPrice: null, missingFields: [] }),
      settings,
    );
    await expect(service.analyze("Assess this", [])).resolves.toMatchObject({
      status: "NEEDS_INPUT",
    });
  });

  it("passes a complete setup through the deterministic engine", async () => {
    const service = new TradeAssessmentService(
      extractor({ ...completeTrade, missingFields: ["planned_position_size"] }),
      settings,
    );
    const result = await service.analyze("Assess this", []);
    expect(result?.status).toBe("FAIL");
    expect(result?.assessment?.gates).toContainEqual(
      expect.objectContaining({ ruleId: "RISK-001", status: "FAIL" }),
    );
  });

  it("does nothing for educational messages", async () => {
    const service = new TradeAssessmentService(
      extractor({
        ...completeTrade,
        isTradeAssessment: false,
      }),
      settings,
    );
    await expect(service.analyze("What is Fibonacci?", [])).resolves.toBeNull();
  });
});
