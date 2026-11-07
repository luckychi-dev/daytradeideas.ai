import { MIN_REWARD_RISK, RULE_IDS } from "./constants.js";
import { isAtLeast, roundCalculation } from "./math.js";
import type { GateResult, TargetCalculation, TradeAssessmentInput } from "./types.js";

function gate(passed: boolean, reason: string): GateResult {
  return {
    ruleId: RULE_IDS.rewardRisk,
    status: passed ? "PASS" : "FAIL",
    reason,
  };
}

export function calculateTargets(
  input: TradeAssessmentInput,
  stopDistance: number,
): TargetCalculation[] {
  return input.targetPrices.map((targetPrice) => {
    const rewardDistance = input.direction === "long"
      ? targetPrice - input.entryPrice
      : input.entryPrice - targetPrice;
    const rewardRisk = rewardDistance / stopDistance;
    return {
      targetPrice,
      rewardDistance: roundCalculation(rewardDistance),
      rewardRisk: roundCalculation(rewardRisk),
      meetsMinimum: isAtLeast(rewardRisk, MIN_REWARD_RISK),
    };
  });
}

export function rewardRiskGate(
  targets: TargetCalculation[],
  qualifyingTargetIndex: number | undefined,
): GateResult {
  if (qualifyingTargetIndex !== undefined) {
    const target = targets[qualifyingTargetIndex - 1];
    if (!target) {
      return {
        ruleId: RULE_IDS.rewardRisk,
        status: "NEEDS_INPUT",
        reason: "The qualifying target is not one of the supplied targets.",
      };
    }
    return gate(
      target.meetsMinimum,
      `Target ${target.targetPrice} is ${target.rewardRisk.toFixed(2)}:1; minimum is ${MIN_REWARD_RISK}:1.`,
    );
  }

  const passing = targets.filter((target) => target.meetsMinimum);
  if (passing.length === targets.length) {
    return gate(
      true,
      `All supplied targets meet the ${MIN_REWARD_RISK}:1 minimum.`,
    );
  }
  if (passing.length === 0) {
    return gate(
      false,
      `No supplied target meets the ${MIN_REWARD_RISK}:1 minimum.`,
    );
  }
  return {
    ruleId: RULE_IDS.rewardRisk,
    status: "NEEDS_INPUT",
    reason:
      "Multiple targets produce conflicting reward-to-risk results. Identify which realistic target qualifies the entry.",
  };
}
