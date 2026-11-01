import { describe, expect, it } from "vitest";
import { assessTrade, rewardRiskFor } from "./trade-engine.js";
import type { TradeAssessmentInput } from "./types.js";

const base: TradeAssessmentInput = {
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

describe("assessTrade", () => {
  it("passes exactly 1.5R when every mandatory gate passes", () => {
    const result = assessTrade(base);
    expect(result.overallStatus).toBe("PASS");
    expect(result.calculations?.targets[0]?.rewardRisk).toBe(1.5);
    expect(result.calculations?.plannedMonetaryRisk).toBe(100);
  });

  it("fails a target below 1.5R and names the rule", () => {
    const result = assessTrade({ ...base, targetPrices: [114.99, 120] });
    expect(result.overallStatus).toBe("FAIL");
    expect(result.gates).toContainEqual(
      expect.objectContaining({ ruleId: "RISK-001", status: "FAIL" }),
    );
  });

  it("requires remaining daily, weekly and monthly limits", () => {
    const result = assessTrade({ ...base, remainingLossAllowance: undefined });
    expect(result.overallStatus).toBe("NEEDS_INPUT");
  });

  it("fails when a proposed size exceeds the per-trade allowance", () => {
    const result = assessTrade({ ...base, plannedPositionSize: 11 });
    expect(result.overallStatus).toBe("FAIL");
    expect(result.calculations?.plannedMonetaryRisk).toBe(110);
  });

  it("fails when planned risk does not fit a period allowance", () => {
    const result = assessTrade({
      ...base,
      remainingLossAllowance: { daily: 99, weekly: 200, monthly: 300 },
    });
    expect(result.overallStatus).toBe("FAIL");
  });

  it("rounds position size down to a valid increment", () => {
    const result = assessTrade({
      ...base,
      riskAllowance: 99,
      monetaryLossPerUnitAtStop: 10,
    });
    expect(result.calculations?.maximumPositionSize).toBe(9);
    expect(result.calculations?.plannedMonetaryRisk).toBe(90);
  });

  it("fails an unplanned mental stop", () => {
    const result = assessTrade({ ...base, stopOrderPlanned: false });
    expect(result.overallStatus).toBe("FAIL");
    expect(result.gates).toContainEqual(
      expect.objectContaining({ ruleId: "RISK-002", status: "FAIL" }),
    );
  });

  it("blocks a new trade after a disclosed no-trade condition", () => {
    const result = assessTrade({ ...base, noTradeConditionDisclosed: true });
    expect(result.overallStatus).toBe("FAIL");
    expect(result.gates).toContainEqual(
      expect.objectContaining({ ruleId: "PSY-001", status: "FAIL" }),
    );
  });

  it("requests input when price ordering is inconsistent", () => {
    const result = assessTrade({ ...base, stopPrice: 101 });
    expect(result.overallStatus).toBe("NEEDS_INPUT");
  });

  it("requests a target rather than evaluating an empty plan", () => {
    const result = assessTrade({ ...base, targetPrices: [] });
    expect(result.overallStatus).toBe("NEEDS_INPUT");
  });
});

describe("rewardRiskFor", () => {
  it("uses direction-aware reward and risk distances", () => {
    expect(rewardRiskFor("short", 100, 110, 85)).toBe(1.5);
  });

  it("returns null for a target on the wrong side of entry", () => {
    expect(rewardRiskFor("long", 100, 90, 95)).toBeNull();
  });
});

