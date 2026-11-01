import { describe, expect, it, vi } from "vitest";
import type { SubscriberRepository, WordPressBridge } from "./ports.js";
import { SubscriptionReconciler } from "./subscription-reconciler.js";

const subscribers = {
  activate: vi.fn(),
  ensure: vi.fn(),
  find: vi.fn(),
  findActive: vi.fn(),
  linkAccess: vi.fn(),
  updateAccessByWordpressUserId: vi.fn(async () => {}),
  listLinkedWordpressUserIds: vi.fn(async () => [1, 2, 3]),
} as unknown as SubscriberRepository;
const bridge = {
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
  membershipStatus: vi.fn(async (id: number) => {
    if (id === 2) throw new Error("network");
    return id === 1
      ? {
          valid: true,
          eligible: true,
          memberships: [{ id: 1, planId: 2, status: "wcm-active", endDate: null }],
        }
      : { valid: true, eligible: false, memberships: [] };
  }),
} as unknown as WordPressBridge;

describe("SubscriptionReconciler", () => {
  it("updates active, inactive, and failed linked subscriptions", async () => {
    const result = await new SubscriptionReconciler(subscribers, bridge).reconcile();
    expect(result).toEqual({ checked: 3, active: 1, inactive: 1, failed: 1 });
    expect(subscribers.updateAccessByWordpressUserId).toHaveBeenCalledTimes(2);
    expect(subscribers.updateAccessByWordpressUserId).toHaveBeenCalledWith(1, true, expect.any(Array));
    expect(subscribers.updateAccessByWordpressUserId).toHaveBeenCalledWith(3, false, []);
  });
});
