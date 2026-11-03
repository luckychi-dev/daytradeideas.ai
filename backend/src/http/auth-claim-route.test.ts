import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AccessService } from "../domain/access-service.js";
import type { AuthService } from "../domain/auth-service.js";
import type { VerificationRateLimitRepository } from "../domain/ports.js";
import type { Subscriber } from "../domain/types.js";
import { registerAuthRoutes } from "./auth-routes.js";

const identity = { interfaceKind: "web" as const, externalUserId: "visitor" };
const subscriber: Subscriber = {
  id: "subscriber-a",
  interfaceKind: "web",
  externalUserId: "visitor",
  displayName: "Web visitor",
  status: "active",
  verifiedEmail: "member@example.com",
  wordpressUserId: 42,
  membershipStatus: "wcm-active",
  accessExpiresAt: null,
  lastVerifiedAt: new Date(),
};
const access = { authorize: async () => null } as unknown as AccessService;
const rateLimits: VerificationRateLimitRepository = {
  consume: async () => ({ allowed: true, retryAfterSeconds: 0 }),
};

describe("account takeover routes", () => {
  it("claims an account from an OTP-verified browser identity", async () => {
    const claimAccount = vi.fn(async () => subscriber);
    const app = Fastify();
    await registerAuthRoutes(
      app,
      access,
      { claimAccount } as unknown as AuthService,
      rateLimits,
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/auth/claim-account",
      payload: { identity },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true, active: true });
    expect(claimAccount).toHaveBeenCalledWith(identity);
    await app.close();
  });

  it("returns a takeover-required conflict instead of linking blindly", async () => {
    const app = Fastify();
    await registerAuthRoutes(
      app,
      access,
      {
        verifyCode: async () => {
          const { EmailAlreadyLinkedError } = await import("../domain/auth-service.js");
          throw new EmailAlreadyLinkedError();
        },
      } as unknown as AuthService,
      rateLimits,
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/auth/verify-code",
      payload: { identity, code: "123456" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "account_in_use" });
    await app.close();
  });
});
