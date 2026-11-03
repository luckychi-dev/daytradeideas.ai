import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  BackendApiError,
  type WebBackendPort,
  type WebIdentity,
} from "./backend-client.js";
import { registerWebRoutes } from "./routes.js";

const secret = "s".repeat(32);

function backend(overrides: Partial<WebBackendPort> = {}): WebBackendPort {
  return {
    authStatus: async () => "verification_required",
    requestCode: async () => {},
    verifyCode: async () => ({ verified: true, active: true }),
    claimAccount: async () => ({ verified: true, active: true }),
    unbind: async () => {},
    chat: async () => ({ text: "answer", sources: [] }),
    chatVoice: async () => ({
      text: "answer",
      sources: [],
      transcript: "question",
      transcriptionModel: "test",
    }),
    chatImage: async () => ({ text: "chart answer", sources: [] }),
    supportChat: async () => ({ text: "support", sources: [], plans: [] }),
    ...overrides,
  };
}

async function setup(
  port: WebBackendPort,
  limit = { allowed: true, retryAfterSeconds: 0 },
) {
  const app = Fastify();
  await app.register(registerWebRoutes, {
    backend: port,
    sessionSecret: secret,
    secureCookie: false,
    telegramBotUrl: "https://t.me/jasonsenaibot",
    authLimiter: { consume: () => limit },
  });
  return app;
}

describe("web API routes", () => {
  it("creates a signed browser session without exposing the service token", async () => {
    const app = await setup(backend());
    const response = await app.inject({ method: "GET", url: "/api/session" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: "verification_required",
      telegramBotUrl: "https://t.me/jasonsenaibot",
    });
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(JSON.stringify(response.headers)).not.toContain(secret);
    await app.close();
  });

  it("derives the backend identity from the cookie and a server request id", async () => {
    const chat = vi.fn<WebBackendPort["chat"]>(async () => ({
      text: "grounded answer",
      sources: [],
    }));
    const app = await setup(backend({ authStatus: async () => "active", chat }));
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const cookie = String(session.headers["set-cookie"]).split(";")[0] ?? "";

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { cookie },
      payload: { text: "Explain reward-to-risk" },
    });

    expect(response.statusCode).toBe(200);
    const identity = chat.mock.calls[0]?.[0] as WebIdentity;
    expect(identity.interfaceKind).toBe("web");
    expect(identity.externalUserId).toMatch(/^[a-f0-9]{64}$/);
    expect(chat.mock.calls[0]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    await app.close();
  });

  it("maps backend access failures without leaking internals", async () => {
    const app = await setup(backend({
      authStatus: async () => "active",
      chat: async () => {
        throw new BackendApiError(403, "subscriber_not_allowed");
      },
    }));
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { text: "Review my trade" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "subscriber_not_allowed" });
    await app.close();
  });

  it("uses public support for a visitor without a subscription", async () => {
    const supportChat = vi.fn<WebBackendPort["supportChat"]>(async () => ({
      text: "Index signals cost £79 per month.",
      sources: [],
      plans: [{
        productId: 550,
        name: "Index signals",
        price: 79,
        currency: "GBP",
        billingPeriod: "month",
        billingInterval: 1,
        purchaseUrl: "https://example.com/index-plan",
      }],
    }));
    const app = await setup(backend({ supportChat }));
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { text: "How much is the index plan?" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      text: "Index signals cost £79 per month.",
      plans: [{ purchaseUrl: "https://example.com/index-plan" }],
    });
    expect(supportChat).toHaveBeenCalled();
    await app.close();
  });

  it("verifies an inactive email and returns plans in the same response", async () => {
    const supportChat = vi.fn<WebBackendPort["supportChat"]>(async () => ({
      text: "Choose a plan below.",
      sources: [],
      plans: [],
    }));
    const app = await setup(backend({
      verifyCode: async () => ({ verified: true, active: false }),
      supportChat,
    }));
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/verify-code",
      payload: { code: "123456" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      verified: true,
      active: false,
      support: { text: "Choose a plan below." },
    });
    await app.close();
  });

  it("unbinds the account and rotates the browser session on logout", async () => {
    const unbind = vi.fn<WebBackendPort["unbind"]>(async () => {});
    const app = await setup(backend({ unbind }));
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const cookie = String(session.headers["set-cookie"]).split(";")[0] ?? "";
    const response = await app.inject({
      method: "POST",
      url: "/api/logout",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ loggedOut: true });
    expect(unbind).toHaveBeenCalled();
    expect(response.headers["set-cookie"]).not.toContain(cookie);
    await app.close();
  });

  it("rate-limits verification requests by browser source", async () => {
    const requestCode = vi.fn<WebBackendPort["requestCode"]>(async () => {});
    const app = await setup(
      backend({ requestCode }),
      { allowed: false, retryAfterSeconds: 300 },
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/request-code",
      payload: { email: "member@example.com" },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("300");
    expect(requestCode).not.toHaveBeenCalled();
    await app.close();
  });
});
