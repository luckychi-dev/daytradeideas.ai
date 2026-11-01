import type { AccessPolicy } from "../../domain/ports.js";
import type { SubscriberIdentity } from "../../domain/types.js";

export class AllowlistPolicy implements AccessPolicy {
  private readonly allowedIds: Set<string>;

  constructor(ids: string[]) {
    this.allowedIds = new Set(ids);
  }

  isAllowed(identity: SubscriberIdentity): boolean {
    return identity.interfaceKind === "telegram" && this.allowedIds.has(identity.externalUserId);
  }
}

