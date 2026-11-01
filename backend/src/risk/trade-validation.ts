import { RULE_IDS } from "./constants.js";
import type { GateResult, TradeAssessmentInput } from "./types.js";

export function validateTradeInput(input: TradeAssessmentInput): GateResult | null {
  if (input.targetPrices.length === 0) {
    return {
      ruleId: RULE_IDS.missingData,
      status: "NEEDS_INPUT",
      reason: "At least one explicit target is required to calculate reward-to-risk.",
    };
  }
  const prices = [
    input.entryPrice,
    input.stopPrice,
    ...input.targetPrices,
    input.riskAllowance,
    input.monetaryLossPerUnitAtStop,
    input.positionUnitIncrement,
  ];
  if (prices.some((value) => !Number.isFinite(value) || value <= 0)) {
    return {
      ruleId: RULE_IDS.missingData,
      status: "NEEDS_INPUT",
      reason: "Prices, risk allowance, unit loss, and position increment must be positive finite values.",
    };
  }
  if (
    input.plannedPositionSize !== undefined &&
    (!Number.isFinite(input.plannedPositionSize) || input.plannedPositionSize <= 0)
  ) {
    return {
      ruleId: RULE_IDS.missingData,
      status: "NEEDS_INPUT",
      reason: "The planned position size must be a positive finite value.",
    };
  }
  if (
    input.remainingLossAllowance &&
    Object.values(input.remainingLossAllowance).some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    return {
      ruleId: RULE_IDS.missingData,
      status: "NEEDS_INPUT",
      reason: "Remaining loss allowances must be zero or positive finite values.",
    };
  }
  const validDirection =
    input.direction === "long"
      ? input.stopPrice < input.entryPrice &&
        input.targetPrices.every((target) => target > input.entryPrice)
      : input.stopPrice > input.entryPrice &&
        input.targetPrices.every((target) => target < input.entryPrice);
  if (!validDirection) {
    return {
      ruleId: RULE_IDS.missingData,
      status: "NEEDS_INPUT",
      reason: "Entry, stop, and target ordering does not match the proposed direction.",
    };
  }
  return null;
}

