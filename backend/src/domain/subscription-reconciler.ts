import type { SubscriberRepository, WordPressBridge } from "./ports.js";

export interface ReconcileResult {
  checked: number;
  active: number;
  inactive: number;
  failed: number;
}

export class SubscriptionReconciler {
  constructor(
    private readonly subscribers: SubscriberRepository,
    private readonly bridge: WordPressBridge,
  ) {}

  async reconcile(): Promise<ReconcileResult> {
    const userIds = await this.subscribers.listLinkedWordpressUserIds();
    const result: ReconcileResult = {
      checked: userIds.length,
      active: 0,
      inactive: 0,
      failed: 0,
    };
    for (const userId of userIds) {
      try {
        const status = await this.bridge.membershipStatus(userId);
        const active = status.valid && status.eligible;
        await this.subscribers.updateAccessByWordpressUserId(
          userId,
          active,
          status.memberships,
        );
        if (active) result.active += 1;
        else result.inactive += 1;
      } catch {
        result.failed += 1;
      }
    }
    return result;
  }
}

