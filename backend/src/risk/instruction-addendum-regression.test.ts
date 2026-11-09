import { describe, expect, it } from "vitest";
import { buildModelMessages } from "../domain/prompt.js";
import { assessStopChange } from "./stop-engine.js";
import { assessTrade } from "./trade-engine.js";
import type { StopChangeInput, TradeAssessmentInput } from "./types.js";

const trade: TradeAssessmentInput = {
  direction: "long",
  entryPrice: 100,
  stopPrice: 90,
  targetPrices: [115, 120],
  riskAllowance: 100,
  monetaryLossPerUnitAtStop: 10,
  positionUnitIncrement: 1,
  remainingLossAllowance: { daily: 100, weekly: 200, monthly: 300 },
  stopOrderPlanned: true,
  noTradeConditionDisclosed: false,
};

const stop: StopChangeInput = {
  direction: "long",
  entryPrice: 100,
  originalStopPrice: 90,
  proposedStopPrice: 95,
  favourableMove: 5,
  originalPositionSize: 10,
  proposedPositionSize: 10,
  widerStopJustified: false,
  chartJustifiedTightening: true,
};

function promptText(): string {
  return buildModelMessages("Question", [], [])
    .map((message) => message.content)
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("Instruction Addendum v1.1 regression pack", () => {
  it("01 asks which target qualifies when target outcomes conflict", () => {
    expect(assessTrade({ ...trade, targetPrices: [114.99, 120] }).overallStatus)
      .toBe("NEEDS_INPUT");
  });

  it("02 qualifies on the identified realistic target", () => {
    const result = assessTrade({
      ...trade,
      targetPrices: [110, 120],
      qualifyingTargetIndex: 2,
    });
    expect(result.overallStatus).toBe("PASS");
    expect(result.calculations?.qualifyingTargetIndex).toBe(2);
  });

  it("03 fails when no target reaches 1.5:1", () => {
    expect(assessTrade({ ...trade, targetPrices: [110, 114.99] }).overallStatus)
      .toBe("FAIL");
  });

  it("04 does not re-gate every remaining fragment", () => {
    const result = assessTrade({
      ...trade,
      targetPrices: [110, 120],
      qualifyingTargetIndex: 2,
    });
    expect(result.gates.filter((entry) => entry.ruleId === "RISK-001")).toHaveLength(1);
  });

  it("05 uses the smallest remaining allowance", () => {
    const result = assessTrade({
      ...trade,
      remainingLossAllowance: { daily: 150, weekly: 99, monthly: 300 },
    });
    expect(result.overallStatus).toBe("FAIL");
  });

  it("06 keeps a reached limit suspended after unrealised recovery", () => {
    const result = assessTrade({
      ...trade,
      remainingLossAllowance: { daily: 100, weekly: 200, monthly: 300 },
      lossLimitReached: { daily: true, weekly: false, monthly: false },
    });
    expect(result.overallStatus).toBe("FAIL");
  });

  it("07 requires chart evidence before 1R tightening", () => {
    expect(assessStopChange({ ...stop, chartJustifiedTightening: false }).overallStatus)
      .toBe("NEEDS_INPUT");
  });

  it("08 permits chart-justified tightening before 1R", () => {
    expect(assessStopChange(stop).overallStatus).toBe("PASS");
  });

  it("09 permits leaving the original stop after 1R", () => {
    expect(assessStopChange({
      ...stop,
      proposedStopPrice: 90,
      favourableMove: 10,
    }).overallStatus).toBe("PASS");
  });

  it("10 rejects early breakeven", () => {
    expect(assessStopChange({
      ...stop,
      proposedStopPrice: 100,
      favourableMove: 9.99,
    }).overallStatus).toBe("FAIL");
  });

  it("11 rejects wider risk at unchanged size", () => {
    expect(assessStopChange({
      ...stop,
      proposedStopPrice: 85,
      widerStopJustified: true,
    }).overallStatus).toBe("FAIL");
  });

  it("12 permits a justified wider stop with reduced risk", () => {
    expect(assessStopChange({
      ...stop,
      proposedStopPrice: 85,
      proposedPositionSize: 6,
      widerStopJustified: true,
    }).overallStatus).toBe("PASS");
  });

  it("13 forbids promoting inference into a mandatory rule", () => {
    expect(promptText()).toContain("Never promote an example or inference into a mandatory rule");
  });

  it("14 treats breakeven at 1R as a permission threshold", () => {
    expect(promptText()).toContain("It is a permission threshold");
  });

  it("15 keeps trailing methods distinct without pre-entry selection", () => {
    const text = promptText();
    expect(text).toContain("Do not require the trader to choose a method before entry");
    expect(text).toContain(
      "methodology does not specify whether switching is permitted or prohibited",
    );
    expect(text).toContain("Do not turn that silence into permission, prohibition");
  });

  it("16 treats partial exits as optional and avoids fragment re-gating", () => {
    const text = promptText();
    expect(text).toContain("Partial exits are optional and plan-dependent");
    expect(text).toContain("Do not make a partial conditional on having been allocated in advance");
    expect(text).toContain("describe an early partial as optional and plan-dependent");
    expect(text).toContain("Do not require every target or remaining fragment to pass 1.5:1");
  });

  it("17 distinguishes planned risk, actual loss and recovery suspension", () => {
    const text = promptText();
    expect(text).toContain("Distinguish planned monetary risk from actual realised loss");
    expect(text).toContain("not lifted by a later recovery");
  });

  it("18 separates fresh re-entry from chasing and avoids unsupported caps", () => {
    const text = promptText();
    expect(text).toContain("A stop-out does not automatically ban a fresh trade");
    expect(text).toContain("no universal waiting period");
    expect(text).toContain("Answer the question asked");
    expect(text).toContain("CURRENT TURN");
    expect(text).toContain("answer that gate directly");
  });
});
