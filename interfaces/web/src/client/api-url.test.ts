import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./api-url.js";

describe("web API base URL", () => {
  it("uses the dedicated API origin for production builds", () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe(
      "https://api.ai.daytradeideas.co.uk",
    );
  });

  it("keeps same-origin development and explicit builds configurable", () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe("");
    expect(resolveApiBaseUrl("https://api.example.com/", true)).toBe(
      "https://api.example.com",
    );
  });
});
