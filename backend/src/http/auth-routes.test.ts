import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../domain/auth-service.js";
import type { VerificationRateLimitRepository } from "../domain/ports.js";
import type { AccessService } from "../domain/access-service.js";
import { registerAuthRoutes } from "./auth-routes.js";

const identity = { interfaceKind: "web" as const, externalUserId: "visitor" };

describe("verification rate limits", () => {
  it("rejects repeated request-code attempts with retry information", async () => {
    const requestCode = vi.fn(async () => {});
    const rateLimits: VerificationRateLimitRepository = {
      consume: async () => ({ allowed: false, retryAfterSeconds: 240 }),
    };
    const app = Fastify();
    await registerAuthRoutes(
      app,
      { authorize: async () => null } as unknown as AccessService,
      { requestCode, verifyCode: vi.fn() } as unknown as AuthService,
      rateLimits,
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/auth/request-code",
      payload: { identity, email: "member@example.com" },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("240");
    expect(response.json()).toEqual({ error: "verification_rate_limited" });
    expect(requestCode).not.toHaveBeenCalled();
    await app.close();
  });
});
