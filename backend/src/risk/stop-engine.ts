import { ENGINE_VERSION, RULE_IDS, RULE_VERSION } from "./constants.js";
import { isAtLeast, isFinitePositive, nearlyEqual, roundCalculation } from "./math.js";
import type {
  AssessmentStatus,
  GateResult,
  StopChangeAssessment,
  StopChangeInput,
} from "./types.js";

function statusFrom(gates: GateResult[]): AssessmentStatus {
  if (gates.some((item) => item.status === "FAIL")) return "FAIL";
  if (gates.some((item) => item.status === "NEEDS_INPUT")) return "NEEDS_INPUT";
  return "PASS";
}

function signedRiskDistance(direction: "long" | "short", entry: number, stop: number): number {
  return direction === "long" ? entry - stop : stop - entry;
}

export function assessStopChange(input: StopChangeInput): StopChangeAssessment {
  const values = [
    input.entryPrice,
    input.originalStopPrice,
    input.proposedStopPrice,
    input.favourableMove,
    input.originalPositionSize,
    input.proposedPositionSize,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return {
      overallStatus: "NEEDS_INPUT",
      gates: [{
        ruleId: RULE_IDS.missingData,
        status: "NEEDS_INPUT",
        reason: "All prices, movement, and position-size values must be supplied.",
      }],
      originalRiskDistance: null,
      proposedRiskDistance: null,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
    };
  }
  if (!isFinitePositive(input.originalPositionSize) || !isFinitePositive(input.proposedPositionSize)) {
    return {
      overallStatus: "NEEDS_INPUT",
      gates: [{
        ruleId: RULE_IDS.missingData,
        status: "NEEDS_INPUT",
        reason: "Original and proposed position sizes must be positive.",
      }],
      originalRiskDistance: null,
      proposedRiskDistance: null,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
    };
  }

  const originalRiskDistance = signedRiskDistance(
    input.direction,
    input.entryPrice,
    input.originalStopPrice,
  );
  const proposedRiskDistance = signedRiskDistance(
    input.direction,
    input.entryPrice,
    input.proposedStopPrice,
  );
  if (!isFinitePositive(originalRiskDistance)) {
    return {
      overallStatus: "NEEDS_INPUT",
      gates: [{
        ruleId: RULE_IDS.missingData,
        status: "NEEDS_INPUT",
        reason: "The original stop is not on the risk side of entry.",
      }],
      originalRiskDistance: null,
      proposedRiskDistance: null,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
    };
  }

  const gates: GateResult[] = [];
  const widened = proposedRiskDistance > originalRiskDistance;
  if (widened) {
    const originalRisk = originalRiskDistance * input.originalPositionSize;
    const proposedRisk = Math.max(0, proposedRiskDistance) * input.proposedPositionSize;
    const riskDoesNotIncrease = isAtLeast(originalRisk, proposedRisk);
    gates.push({
      ruleId: RULE_IDS.stopWidening,
      status: input.widerStopJustified && riskDoesNotIncrease ? "PASS" : "FAIL",
      reason:
        input.widerStopJustified && riskDoesNotIncrease
          ? "The wider stop is technically justified and position size keeps monetary risk from increasing."
          : "The stop change widens risk or lacks a justification.",
    });
  }

  const atOrBeyondBreakeven = proposedRiskDistance <= 0 || nearlyEqual(proposedRiskDistance, 0);
  if (atOrBeyondBreakeven) {
    gates.push({
      ruleId: RULE_IDS.breakeven,
      status: isAtLeast(input.favourableMove, originalRiskDistance) ? "PASS" : "FAIL",
      reason: isAtLeast(input.favourableMove, originalRiskDistance)
        ? "Favourable movement has reached at least 1R."
        : "Breakeven or locked profit is premature before 1R.",
    });
  } else if (proposedRiskDistance < originalRiskDistance) {
    gates.push({
      ruleId: RULE_IDS.tightening,
      status: input.chartJustifiedTightening ? "PASS" : "NEEDS_INPUT",
      reason: input.chartJustifiedTightening
        ? "The stop is tightened toward entry without increasing risk."
        : "Tightening before 1R requires chart-identified support or resistance.",
    });
  }

  if (gates.length === 0) {
    gates.push({
      ruleId: RULE_IDS.stopWidening,
      status: "PASS",
      reason: "The proposed stop does not increase monetary risk.",
    });
  }

  return {
    overallStatus: statusFrom(gates),
    gates,
    originalRiskDistance: roundCalculation(originalRiskDistance),
    proposedRiskDistance: roundCalculation(proposedRiskDistance),
    engineVersion: ENGINE_VERSION,
    ruleVersion: RULE_VERSION,
  };
}

