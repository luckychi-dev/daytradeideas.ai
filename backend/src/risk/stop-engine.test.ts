import { describe, expect, it } from "vitest";
import { assessStopChange } from "./stop-engine.js";
import type { StopChangeInput } from "./types.js";

const base: StopChangeInput = {
  direction: "long",
  entryPrice: 100,
  originalStopPrice: 90,
  proposedStopPrice: 100,
  favourableMove: 10,
  originalPositionSize: 10,
  proposedPositionSize: 10,
  widerStopJustified: false,
  chartJustifiedTightening: false,
};

describe("assessStopChange", () => {
  it("allows breakeven at exactly 1R", () => {
    const result = assessStopChange(base);
    expect(result.overallStatus).toBe("PASS");
  });

  it("rejects breakeven before 1R", () => {
    const result = assessStopChange({ ...base, favourableMove: 9.99 });
    expect(result.overallStatus).toBe("FAIL");
    expect(result.gates).toContainEqual(
      expect.objectContaining({ ruleId: "TRADE-001", status: "FAIL" }),
    );
  });

  it("rejects locked profit before 1R", () => {
    const result = assessStopChange({
      ...base,
      proposedStopPrice: 105,
      favourableMove: 9,
    });
    expect(result.overallStatus).toBe("FAIL");
  });

  it("rejects a wider stop at unchanged size", () => {
    const result = assessStopChange({
      ...base,
      proposedStopPrice: 85,
      favourableMove: 5,
      widerStopJustified: true,
    });
    expect(result.overallStatus).toBe("FAIL");
  });

  it("allows a justified wider stop after reducing monetary risk", () => {
    const result = assessStopChange({
      ...base,
      proposedStopPrice: 85,
      proposedPositionSize: 6,
      favourableMove: 5,
      widerStopJustified: true,
    });
    expect(result.overallStatus).toBe("PASS");
  });

  it("requires chart evidence when tightening before 1R", () => {
    const result = assessStopChange({
      ...base,
      proposedStopPrice: 95,
      favourableMove: 5,
    });
    expect(result.overallStatus).toBe("NEEDS_INPUT");
  });

  it("allows chart-justified tightening before 1R", () => {
    const result = assessStopChange({
      ...base,
      proposedStopPrice: 95,
      favourableMove: 5,
      chartJustifiedTightening: true,
    });
    expect(result.overallStatus).toBe("PASS");
  });
});

