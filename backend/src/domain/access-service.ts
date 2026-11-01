import type { AccessPolicy, SubscriberRepository } from "./ports.js";
import type { Subscriber, SubscriberIdentity } from "./types.js";

export class AccessService {
  constructor(
    private readonly policy: AccessPolicy,
    private readonly subscribers: SubscriberRepository,
  ) {}

  async authorize(identity: SubscriberIdentity): Promise<Subscriber | null> {
    if (this.policy.isAllowed(identity)) {
      const subscriber = await this.subscribers.activate(identity);
      return subscriber.status === "active" ? subscriber : null;
    }
    const subscriber = await this.subscribers.findActive(
      identity.interfaceKind,
      identity.externalUserId,
    );
    return subscriber?.wordpressUserId && subscriber.verifiedEmail ? subscriber : null;
  }
}
