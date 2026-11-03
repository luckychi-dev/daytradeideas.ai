import type {
  ConversationContext,
  AuthSession,
  InterfaceKind,
  KnowledgeHit,
  MembershipPlan,
  ModelRequest,
  ModelResult,
  Subscriber,
  SubscriberIdentity,
  SubscriptionEvent,
  TranscriptionResult,
  VisionRequest,
  VisionResult,
  WordPressVerification,
  WordPressMembershipState,
} from "./types.js";
import type { DailyUsage, RuntimeSettings, UsageEvent } from "./usage-types.js";

export interface AccessPolicy {
  isAllowed(identity: SubscriberIdentity): boolean;
}

export interface SubscriberRepository {
  activate(identity: SubscriberIdentity): Promise<Subscriber>;
  ensure(identity: SubscriberIdentity): Promise<Subscriber>;
  find(interfaceKind: InterfaceKind, externalUserId: string): Promise<Subscriber | null>;
  findActive(interfaceKind: InterfaceKind, externalUserId: string): Promise<Subscriber | null>;
  linkAccess(
    subscriberId: string,
    email: string,
    wordpressUserId: number,
    memberships: WordPressVerification["memberships"],
  ): Promise<void>;
  takeoverAccess(
    identity: SubscriberIdentity,
    subscriberId: string,
    email: string,
    wordpressUserId: number,
    memberships: WordPressVerification["memberships"],
  ): Promise<Subscriber>;
  unbind(interfaceKind: InterfaceKind, externalUserId: string): Promise<void>;
  updateAccessByWordpressUserId(
    wordpressUserId: number,
    active: boolean,
    memberships: WordPressVerification["memberships"],
  ): Promise<void>;
  listLinkedWordpressUserIds(): Promise<number[]>;
}

export interface AuthSessionRepository {
  save(interfaceKind: InterfaceKind, externalUserId: string, email: string): Promise<void>;
  get(interfaceKind: InterfaceKind, externalUserId: string): Promise<AuthSession | null>;
  markClaimable(
    interfaceKind: InterfaceKind,
    externalUserId: string,
    wordpressUserId: number,
    memberships: WordPressVerification["memberships"],
    expiresAt: Date,
  ): Promise<void>;
  clear(interfaceKind: InterfaceKind, externalUserId: string): Promise<void>;
}

export interface VerificationRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface VerificationRateLimitRepository {
  consume(
    interfaceKind: InterfaceKind,
    externalUserId: string,
    action: "request_code" | "verify_code",
    limit: number,
    windowSeconds: number,
  ): Promise<VerificationRateLimitDecision>;
}

export interface WordPressBridge {
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<WordPressVerification>;
  membershipStatus(wordpressUserId: number): Promise<WordPressMembershipState>;
  plans(): Promise<MembershipPlan[]>;
}

export interface ConversationRepository {
  loadRecent(
    subscriberId: string,
    interfaceKind: InterfaceKind,
    limit: number,
  ): Promise<ConversationContext>;
  appendMessage(
    conversationId: string,
    subscriberId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<void>;
}

export interface KnowledgeRetriever {
  search(query: string, limit: number): Promise<KnowledgeHit[]>;
}

export interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResult>;
}

export interface TranscriptionProvider {
  transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>;
}

export interface VisionProvider {
  analyze(request: VisionRequest): Promise<VisionResult>;
}

export interface UsageRepository {
  record(event: UsageEvent): Promise<void>;
  monthlySpendUsd(): Promise<number>;
  dailyUsage(subscriberId: string, since: Date): Promise<DailyUsage>;
}

export interface RuntimeSettingsRepository {
  get(): Promise<RuntimeSettings>;
  update(settings: RuntimeSettings, actor: string): Promise<void>;
}

export interface SubscriptionEventRepository {
  apply(event: SubscriptionEvent): Promise<void>;
}
