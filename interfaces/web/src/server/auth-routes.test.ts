import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { WebBackendPort, WebIdentity } from "./backend-client.js";
import { registerWebAuthRoutes } from "./auth-routes.js";

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
    chatImage: async () => ({ text: "answer", sources: [] }),
    supportChat: async () => ({ text: "support", sources: [], plans: [] }),
    ...overrides,
  };
}

async function setup(port: WebBackendPort) {
  const app = Fastify();
  await app.register(registerWebAuthRoutes, {
    backend: port,
    sessionSecret: secret,
    secureCookie: false,
    authLimiter: { consume: () => ({ allowed: true, retryAfterSeconds: 0 }) },
  });
  return app;
}

describe("web account takeover routes", () => {
  it("forwards the signed browser identity when taking over a session", async () => {
    let claimedIdentity: WebIdentity | undefined;
    const app = await setup(backend({
      claimAccount: async (identity) => {
        claimedIdentity = identity;
        return { verified: true, active: true };
      },
    }));
    const session = await app.inject({ method: "GET", url: "/api/session" });
    const cookie = String(session.headers["set-cookie"]).split(";")[0] ?? "";

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/claim-account",
      headers: { cookie },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true, active: true });
    expect(claimedIdentity?.externalUserId).toMatch(/^[a-f0-9]{64}$/);
    await app.close();
  });
});
