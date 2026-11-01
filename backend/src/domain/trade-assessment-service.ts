import { assessTrade } from "../risk/trade-engine.js";
import type { RuntimeSettingsRepository } from "./ports.js";
import type { TradeExtractor } from "./trade-extractor.js";
import type { TradeAssessmentOutcome } from "./trade-assessment-types.js";

const required = [
  "direction",
  "entryPrice",
  "stopPrice",
  "targetPrices",
  "riskAllowance",
  "monetaryLossPerUnitAtStop",
  "positionUnitIncrement",
  "remainingLossAllowance",
  "stopOrderPlanned",
];

export class TradeAssessmentService {
  constructor(
    private readonly extractor: TradeExtractor,
    private readonly settings: RuntimeSettingsRepository,
  ) {}

  async analyze(
    text: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<TradeAssessmentOutcome | null> {
    const settings = await this.settings.get();
    if (!settings.tradeAssessmentEnabled) return null;
    const extraction = await this.extractor.extract(text, history);
    if (!extraction.trade.isTradeAssessment) return null;
    const missing = new Set<string>();
    for (const field of required) {
      const value = extraction.trade[field as keyof typeof extraction.trade];
      if (value === null || (Array.isArray(value) && value.length === 0)) missing.add(field);
    }
    if (missing.size > 0) {
      return {
        status: "NEEDS_INPUT",
        usage: extraction,
        context:
          `Status: NEEDS_INPUT\nMissing fields: ${[...missing].join(", ")}\n` +
          "Ask for one material missing fact. Do not give a PASS verdict.",
      };
    }
    const trade = extraction.trade;
    const assessment = assessTrade({
      direction: trade.direction!,
      entryPrice: trade.entryPrice!,
      stopPrice: trade.stopPrice!,
      targetPrices: trade.targetPrices,
      riskAllowance: trade.riskAllowance!,
      monetaryLossPerUnitAtStop: trade.monetaryLossPerUnitAtStop!,
      positionUnitIncrement: trade.positionUnitIncrement!,
      ...(trade.plannedPositionSize !== null
        ? { plannedPositionSize: trade.plannedPositionSize }
        : {}),
      remainingLossAllowance: trade.remainingLossAllowance!,
      stopOrderPlanned: trade.stopOrderPlanned!,
      noTradeConditionDisclosed: trade.noTradeConditionDisclosed,
    });
    return {
      status: assessment.overallStatus,
      assessment,
      usage: extraction,
      context:
        `Status: ${assessment.overallStatus}\n` +
        `Rule engine result: ${JSON.stringify(assessment)}\n` +
        "Do not change this status. Explain the failed gates or ask for missing data.",
    };
  }
}
