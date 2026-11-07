import { ENGINE_VERSION, RULE_IDS, RULE_VERSION } from "./constants.js";
import { isAtLeast, isFinitePositive, nearlyEqual, roundCalculation, roundDownToIncrement } from "./math.js";
import { calculateTargets, rewardRiskGate } from "./target-qualification.js";
import { validateTradeInput } from "./trade-validation.js";
import type {
  AssessmentStatus,
  GateResult,
  TradeAssessment,
  TradeAssessmentInput,
  TradeCalculations,
} from "./types.js";

function statusFrom(gates: GateResult[]): AssessmentStatus {
  if (gates.some((gate) => gate.status === "FAIL")) return "FAIL";
  if (gates.some((gate) => gate.status === "NEEDS_INPUT")) return "NEEDS_INPUT";
  return "PASS";
}

function gate(ruleId: string, passed: boolean, reason: string): GateResult {
  return { ruleId, status: passed ? "PASS" : "FAIL", reason };
}

function assessmentGates(
  input: TradeAssessmentInput,
  targets: TradeCalculations["targets"],
  risk: number,
): GateResult[] {
  const gates: GateResult[] = [
    gate(
      RULE_IDS.stopOrder,
      input.stopOrderPlanned,
      input.stopOrderPlanned
        ? "A stop-loss order is planned when the trade is executed."
        : "A mental stop is insufficient; an actual stop-loss order must be planned.",
    ),
    gate(
      RULE_IDS.psychology,
      !input.noTradeConditionDisclosed,
      input.noTradeConditionDisclosed
        ? "No new trade should be taken while the disclosed high-risk condition applies."
        : "No disclosed no-trade condition was supplied.",
    ),
  ];

  gates.push(rewardRiskGate(targets, input.qualifyingTargetIndex));

  if (
    input.lossLimitReached &&
    Object.values(input.lossLimitReached).some(Boolean)
  ) {
    gates.push({
      ruleId: RULE_IDS.periodLimits,
      status: "FAIL",
      reason: "A daily, weekly, or monthly loss limit has already been reached; no new trade is allowed.",
    });
  }

  gates.push(
    gate(
      RULE_IDS.consistentRisk,
      isAtLeast(input.riskAllowance, risk) && risk > 0,
      `Planned loss ${risk.toFixed(2)} must not exceed the trade risk allowance ${input.riskAllowance.toFixed(2)}.`,
    ),
  );

  if (!input.remainingLossAllowance) {
    gates.push({
      ruleId: RULE_IDS.lossAllowance,
      status: "NEEDS_INPUT",
      reason: "Remaining daily, weekly, and monthly loss allowances are required.",
    });
    return gates;
  }

  for (const [period, remaining] of Object.entries(input.remainingLossAllowance)) {
    gates.push(
      gate(
        RULE_IDS.periodLimits,
        isAtLeast(remaining, risk),
        `Planned loss ${risk.toFixed(2)} compared with the remaining ${period} allowance ${remaining.toFixed(2)}.`,
      ),
    );
  }
  return gates;
}

export function assessTrade(input: TradeAssessmentInput): TradeAssessment {
  const validation = validateTradeInput(input);
  if (validation) {
    return {
      overallStatus: validation.status === "PASS" ? "PASS" : "NEEDS_INPUT",
      gates: [validation],
      calculations: null,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
    };
  }

  const stopDistance = roundCalculation(Math.abs(input.entryPrice - input.stopPrice));
  const maximumPositionSize = roundDownToIncrement(
    input.riskAllowance / input.monetaryLossPerUnitAtStop,
    input.positionUnitIncrement,
  );
  if (maximumPositionSize <= 0) {
    return {
      overallStatus: "FAIL",
      gates: [{
        ruleId: RULE_IDS.consistentRisk,
        status: "FAIL",
        reason: "The risk allowance cannot fund one valid position increment at this stop.",
      }],
      calculations: null,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
    };
  }

  const plannedPositionSize = input.plannedPositionSize ?? maximumPositionSize;
  const risk = roundCalculation(plannedPositionSize * input.monetaryLossPerUnitAtStop);
  const targets = calculateTargets(input, stopDistance);
  const gates = assessmentGates(input, targets, risk);
  const qualifyingTargetIndex = input.qualifyingTargetIndex ?? (
    input.targetPrices.length === 1 ? 1 : null
  );
  const calculations: TradeCalculations = {
    stopDistance,
    maximumPositionSize,
    plannedPositionSize,
    plannedMonetaryRisk: risk,
    qualifyingTargetIndex,
    targets,
  };

  return {
    overallStatus: statusFrom(gates),
    gates,
    calculations,
    engineVersion: ENGINE_VERSION,
    ruleVersion: RULE_VERSION,
  };
}

export function rewardRiskFor(
  direction: "long" | "short",
  entry: number,
  stop: number,
  target: number,
): number | null {
  if (![entry, stop, target].every(isFinitePositive) || nearlyEqual(entry, stop)) return null;
  const risk = Math.abs(entry - stop);
  const reward = direction === "long" ? target - entry : entry - target;
  return reward > 0 ? roundCalculation(reward / risk) : null;
}
