import type {
  AuthSessionRepository,
  SubscriberRepository,
  WordPressBridge,
} from "./ports.js";
import type { Subscriber, SubscriberIdentity } from "./types.js";

export class InvalidVerificationError extends Error {}
export class SubscriptionInactiveError extends Error {}
export class EmailAlreadyLinkedError extends Error {}
export class EmailMismatchError extends Error {}
export class TakeoverNotAvailableError extends Error {}

export type AuthState =
  | "active"
  | "verification_required"
  | "awaiting_otp"
  | "inactive";

export class AuthService {
  constructor(
    private readonly subscribers: SubscriberRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly bridge: WordPressBridge,
  ) {}

  async status(identity: SubscriberIdentity): Promise<{ state: AuthState; subscriber: Subscriber }> {
    const subscriber = await this.subscribers.ensure(identity);
    if (subscriber.status === "active" && subscriber.wordpressUserId) {
      return { state: "active", subscriber };
    }
    const session = await this.sessions.get(identity.interfaceKind, identity.externalUserId);
    if (session) return { state: "awaiting_otp", subscriber };
    if (subscriber.wordpressUserId) return { state: "inactive", subscriber };
    return { state: "verification_required", subscriber };
  }

  async requestCode(identity: SubscriberIdentity, rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isEmail(email)) throw new InvalidVerificationError("Enter a valid email address.");
    const subscriber = await this.subscribers.ensure(identity);
    if (subscriber.verifiedEmail && subscriber.verifiedEmail !== email) {
      throw new EmailMismatchError("This Telegram account is already linked to another email.");
    }
    await this.bridge.requestCode(email);
    await this.sessions.save(identity.interfaceKind, identity.externalUserId, email);
  }

  async verifyCode(identity: SubscriberIdentity, code: string): Promise<Subscriber> {
    const session = await this.sessions.get(identity.interfaceKind, identity.externalUserId);
    if (!session || session.state !== "awaiting_otp") {
      throw new InvalidVerificationError("Request a new verification code.");
    }
    const subscriber = await this.subscribers.ensure(identity);
    const verification = await this.bridge.verifyCode(session.email, code);
    if (!verification.valid) throw new InvalidVerificationError("That code is invalid or expired.");
    if (!verification.wordpressUserId) {
      throw new InvalidVerificationError("WordPress did not return an account.");
    }
    try {
      await this.subscribers.linkAccess(
        subscriber.id,
        verification.email,
        verification.wordpressUserId,
        verification.memberships,
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        await this.sessions.markClaimable(
          identity.interfaceKind,
          identity.externalUserId,
          verification.wordpressUserId,
          verification.memberships,
          new Date(Date.now() + 600_000),
        );
        throw new EmailAlreadyLinkedError("This subscription is already linked to another account.");
      }
      throw error;
    }
    await this.sessions.clear(identity.interfaceKind, identity.externalUserId);
    const linked = await this.subscribers.find(
      identity.interfaceKind,
      identity.externalUserId,
    );
    if (!linked) throw new InvalidVerificationError("Subscriber verification failed.");
    return linked;
  }

  async claimAccount(identity: SubscriberIdentity): Promise<Subscriber> {
    const session = await this.sessions.get(identity.interfaceKind, identity.externalUserId);
    if (!session || session.state !== "claimable" || !session.wordpressUserId) {
      throw new TakeoverNotAvailableError("Verify this account again before taking over the session.");
    }
    const subscriber = await this.subscribers.ensure(identity);
    const linked = await this.subscribers.takeoverAccess(
      identity,
      subscriber.id,
      session.email,
      session.wordpressUserId,
      session.memberships,
    );
    await this.sessions.clear(identity.interfaceKind, identity.externalUserId);
    return linked;
  }

  async unbind(identity: SubscriberIdentity): Promise<void> {
    await this.subscribers.unbind(identity.interfaceKind, identity.externalUserId);
    await this.sessions.clear(identity.interfaceKind, identity.externalUserId);
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private isEmail(value: string): boolean {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
