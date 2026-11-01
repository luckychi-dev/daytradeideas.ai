import { afterEach, describe, expect, it, vi } from "vitest";
import { WordPressBridgeClient } from "./wordpress-bridge-client.js";

afterEach(() => vi.unstubAllGlobals());

describe("WordPressBridgeClient", () => {
  it("refreshes a linked WordPress membership with HMAC headers", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        valid: true,
        eligible: true,
        wordpress_user_id: 42,
        memberships: [{
          id: 1,
          plan_id: 2,
          status: "wcm-active",
          end_date: null,
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WordPressBridgeClient({
      baseUrl: "https://wordpress.example/wp-json/dtiai/v1",
      secret: "s".repeat(32),
    });
    await expect(client.membershipStatus(42)).resolves.toEqual({
      valid: true,
      eligible: true,
      memberships: [{ id: 1, planId: 2, status: "wcm-active", endDate: null }],
    });
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://wordpress.example/wp-json/dtiai/v1/membership-status");
    expect(request).toMatchObject({
      headers: expect.objectContaining({
        "x-dtiai-signature": expect.any(String),
        "x-dtiai-nonce": expect.any(String),
      }),
    });
  });

  it("loads purchasable subscription plans through the signed bridge", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        plans: [{
          product_id: 550,
          name: "Index signals",
          description: "S&P 500, Nasdaq and Dow Jones.",
          price: 79,
          regular_price: 79,
          sale_price: null,
          currency: "GBP",
          billing_period: "month",
          billing_interval: 1,
          purchase_url: "https://example.com/product/index",
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WordPressBridgeClient({
      baseUrl: "https://wordpress.example/wp-json/dtiai/v1",
      secret: "s".repeat(32),
    });

    await expect(client.plans()).resolves.toEqual([{
      productId: 550,
      name: "Index signals",
      description: "S&P 500, Nasdaq and Dow Jones.",
      price: 79,
      regularPrice: 79,
      salePrice: null,
      currency: "GBP",
      billingPeriod: "month",
      billingInterval: 1,
      purchaseUrl: "https://example.com/product/index",
    }]);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://wordpress.example/wp-json/dtiai/v1/plans");
  });
});
