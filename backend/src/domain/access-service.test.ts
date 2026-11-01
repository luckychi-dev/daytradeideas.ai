import { describe, expect, it, vi } from "vitest";
import { AccessService } from "./access-service.js";
import type { AccessPolicy, SubscriberRepository } from "./ports.js";
import type { Subscriber, SubscriberIdentity } from "./types.js";

const identity: SubscriberIdentity = {
  interfaceKind: "telegram",
  externalUserId: "123",
};

const activeSubscriber: Subscriber = {
  id: "subscriber-a",
  interfaceKind: "telegram",
  externalUserId: "123",
  displayName: "Test",
  status: "active",
  verifiedEmail: null,
  wordpressUserId: null,
  membershipStatus: null,
  accessExpiresAt: null,
  lastVerifiedAt: null,
};

describe("AccessService", () => {
  it("does not touch persistence for an uninvited identity", async () => {
    const policy: AccessPolicy = { isAllowed: () => false };
    const activate = vi.fn<SubscriberRepository["activate"]>();
    const service = new AccessService(policy, { activate, findActive: vi.fn() });
    await expect(service.authorize(identity)).resolves.toBeNull();
    expect(activate).not.toHaveBeenCalled();
  });

  it("returns only an active invited subscriber", async () => {
    const service = new AccessService(
      { isAllowed: () => true },
      {
        activate: async () => activeSubscriber,
        findActive: async () => activeSubscriber,
      },
    );
    await expect(service.authorize(identity)).resolves.toEqual(activeSubscriber);
  });

  it("rejects a suspended subscriber after activation check", async () => {
    const suspended = { ...activeSubscriber, status: "suspended" as const };
    const service = new AccessService(
      { isAllowed: () => true },
      { activate: async () => suspended, findActive: async () => suspended },
    );
    await expect(service.authorize(identity)).resolves.toBeNull();
  });

  it("permits a verified subscriber without the bootstrap allowlist", async () => {
    const linked = {
      ...activeSubscriber,
      verifiedEmail: "member@example.com",
      wordpressUserId: 42,
      membershipStatus: "wcm-active",
    };
    const service = new AccessService(
      { isAllowed: () => false },
      {
        activate: async () => linked,
        ensure: async () => linked,
        find: async () => linked,
        findActive: async () => linked,
        linkAccess: async () => {},
        updateAccessByWordpressUserId: async () => {},
      },
    );
    await expect(service.authorize(identity)).resolves.toEqual(linked);
  });
});
