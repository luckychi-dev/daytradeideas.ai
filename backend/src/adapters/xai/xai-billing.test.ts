import { afterEach, describe, expect, it, vi } from "vitest";
import { XaiBillingClient } from "./xai-billing.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("XaiBillingClient", () => {
  it("reports no balance when management credentials are absent", async () => {
    const client = new XaiBillingClient({
      baseURL: "https://management-api.x.ai",
    });

    await expect(client.getPrepaidBalance()).resolves.toBeNull();
  });

  it("converts signed USD cents into the available prepaid balance", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      changes: [],
      total: { val: "-1000" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new XaiBillingClient({
      managementKey: "management-key",
      teamId: "team-id",
      baseURL: "https://management-api.x.ai/",
    });

    const result = await client.getPrepaidBalance();

    expect(result).toMatchObject({
      availableUsd: 10,
      currency: "USD",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://management-api.x.ai/v1/billing/teams/team-id/prepaid/balance",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer management-key",
        }),
      }),
    );
  });

  it("fails without exposing the provider response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const client = new XaiBillingClient({
      managementKey: "management-key",
      teamId: "team-id",
      baseURL: "https://management-api.x.ai",
    });

    await expect(client.getPrepaidBalance()).rejects.toThrow(
      "xAI billing request failed with status 401.",
    );
  });
});
