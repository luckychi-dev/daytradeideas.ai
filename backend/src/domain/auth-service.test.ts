import { describe, expect, it, vi } from "vitest";
import {
  AuthService,
  EmailAlreadyLinkedError,
  TakeoverNotAvailableError,
} from "./auth-service.js";
import type {
  AuthSessionRepository,
  SubscriberRepository,
  WordPressBridge,
} from "./ports.js";
import type { AuthSession, Subscriber } from "./types.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: "subscriber-a",
    interfaceKind: "telegram",
    externalUserId: "123",
    displayName: "Test",
    status: "pending",
    verifiedEmail: null,
    wordpressUserId: null,
    membershipStatus: null,
    accessExpiresAt: null,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function repositories() {
  let current = subscriber();
  let session: AuthSession | null = null;
  const takeoverAccess = vi.fn<SubscriberRepository["takeoverAccess"]>(
    async (_identity, _id, email, wordpressUserId, memberships) => {
      current = subscriber({
        status: memberships.length > 0 ? "active" : "pending",
        verifiedEmail: email,
        wordpressUserId,
        membershipStatus: memberships.length > 0 ? "wcm-active" : "inactive",
      });
      return current;
    },
  );
  const subscribers: SubscriberRepository = {
    activate: async () => current,
    ensure: async () => current,
    find: async () => current,
    findActive: async () => current.status === "active" ? current : null,
    linkAccess: vi.fn(async (_id, email, wordpressUserId, memberships) => {
      current = subscriber({
        status: memberships.length > 0 ? "active" : "pending",
        verifiedEmail: email,
        wordpressUserId,
        membershipStatus: memberships.length > 0 ? "wcm-active" : "inactive",
      });
    }),
    takeoverAccess,
    unbind: async () => {},
    updateAccessByWordpressUserId: async () => {},
  };
  const sessions: AuthSessionRepository = {
    save: async (_kind, _id, email) => {
      session = {
        email,
        expiresAt: new Date(Date.now() + 600_000),
        state: "awaiting_otp",
        wordpressUserId: null,
        memberships: [],
      };
    },
    get: async () => session,
    markClaimable: vi.fn(async (_kind, _id, wordpressUserId, memberships, expiresAt) => {
      if (!session) return;
      session = {
        ...session,
        state: "claimable",
        wordpressUserId,
        memberships,
        expiresAt,
      };
    }),
    clear: async () => {
      session = null;
    },
  };
  const bridge: WordPressBridge = {
    requestCode: vi.fn(async () => {}),
    plans: vi.fn(async () => []),
    verifyCode: vi.fn(async () => ({
      valid: true,
      eligible: true,
      wordpressUserId: 42,
      email: "member@example.com",
      memberships: [{ id: 1, planId: 2, status: "wcm-active", endDate: null }],
    })),
  };
  return { subscribers, sessions, bridge, takeoverAccess };
}

describe("AuthService", () => {
  it("requests a code and verifies an active member", async () => {
    const ports = repositories();
    const service = new AuthService(ports.subscribers, ports.sessions, ports.bridge);
    await service.requestCode(identity, " Member@Example.com ");
    expect(ports.bridge.requestCode).toHaveBeenCalledWith("member@example.com");
    const linked = await service.verifyCode(identity, "123456");
    expect(linked.status).toBe("active");
    expect(ports.subscribers.linkAccess).toHaveBeenCalledWith(
      "subscriber-a",
      "member@example.com",
      42,
      expect.any(Array),
    );
  });

  it("maps a database uniqueness conflict to an already-linked email", async () => {
    const ports = repositories();
    vi.mocked(ports.subscribers.linkAccess).mockRejectedValueOnce({ code: "23505" });
    const service = new AuthService(ports.subscribers, ports.sessions, ports.bridge);
    await service.requestCode(identity, "member@example.com");
    await expect(service.verifyCode(identity, "123456"))
      .rejects.toBeInstanceOf(EmailAlreadyLinkedError);
    expect(ports.sessions.markClaimable).toHaveBeenCalledWith(
      "telegram",
      "123",
      42,
      expect.any(Array),
      expect.any(Date),
    );
  });

  it("takes over an account only after its OTP was verified", async () => {
    const ports = repositories();
    vi.mocked(ports.subscribers.linkAccess).mockRejectedValueOnce({ code: "23505" });
    const service = new AuthService(ports.subscribers, ports.sessions, ports.bridge);
    await service.requestCode(identity, "member@example.com");
    await expect(service.verifyCode(identity, "123456"))
      .rejects.toBeInstanceOf(EmailAlreadyLinkedError);

    await expect(service.claimAccount(identity)).resolves.toMatchObject({
      status: "active",
      wordpressUserId: 42,
    });
    expect(ports.takeoverAccess).toHaveBeenCalledWith(
      identity,
      "subscriber-a",
      "member@example.com",
      42,
      expect.any(Array),
    );
  });

  it("refuses takeover without an OTP-backed claimable session", async () => {
    const ports = repositories();
    const service = new AuthService(ports.subscribers, ports.sessions, ports.bridge);
    await expect(service.claimAccount(identity))
      .rejects.toBeInstanceOf(TakeoverNotAvailableError);
    expect(ports.takeoverAccess).not.toHaveBeenCalled();
  });

  it("verifies an email without an active subscription", async () => {
    const ports = repositories();
    vi.mocked(ports.bridge.verifyCode).mockResolvedValueOnce({
      valid: true,
      eligible: false,
      wordpressUserId: 42,
      email: "member@example.com",
      memberships: [],
    });
    const service = new AuthService(ports.subscribers, ports.sessions, ports.bridge);
    await service.requestCode(identity, "member@example.com");

    await expect(service.verifyCode(identity, "123456")).resolves.toMatchObject({
      status: "pending",
      verifiedEmail: "member@example.com",
      membershipStatus: "inactive",
    });
  });
});
