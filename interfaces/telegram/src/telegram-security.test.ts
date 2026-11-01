import { describe, expect, it } from "vitest";
import { secretMatches } from "./webhook-route.js";
import { splitAtBoundary } from "./client.js";

describe("Telegram webhook security", () => {
  it("accepts only the exact secret header", () => {
    expect(secretMatches("expected-secret", "expected-secret")).toBe(true);
    expect(secretMatches("wrong-secret", "expected-secret")).toBe(false);
    expect(secretMatches(undefined, "expected-secret")).toBe(false);
  });

  it("splits long messages below Telegram's send limit", () => {
    const chunks = splitAtBoundary(`${"a".repeat(2500)} ${"b".repeat(2500)}`, 4000);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= 4000)).toBe(true);
  });
});
