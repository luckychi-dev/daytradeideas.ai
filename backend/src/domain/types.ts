export type InterfaceKind = "telegram" | "web" | "mobile" | "whatsapp";

export interface SubscriberIdentity {
  interfaceKind: InterfaceKind;
  externalUserId: string;
  displayName?: string;
  username?: string;
}

export interface Subscriber {
  id: string;
  interfaceKind: InterfaceKind;
  externalUserId: string;
  displayName: string | null;
  status: "pending" | "active" | "suspended";
  verifiedEmail: string | null;
  wordpressUserId: number | null;
  membershipStatus: string | null;
  accessExpiresAt: Date | null;
  lastVerifiedAt: Date | null;
}

export interface AuthSession {
  email: string;
  expiresAt: Date;
  state: "awaiting_otp" | "claimable";
  wordpressUserId: number | null;
  memberships: WordPressMembership[];
}

export interface WordPressMembership {
  id: number;
  planId: number;
  status: string;
  endDate: number | null;
}

export interface WordPressVerification {
  valid: boolean;
  eligible: boolean;
  wordpressUserId: number | null;
  email: string;
  memberships: WordPressMembership[];
}

export interface WordPressMembershipState {
  valid: boolean;
  eligible: boolean;
  memberships: WordPressMembership[];
}

export interface MembershipPlan {
  productId: number;
  name: string;
  description: string;
  price: number;
  regularPrice: number;
  salePrice: number | null;
  currency: string;
  billingPeriod: string;
  billingInterval: number;
  purchaseUrl: string;
}

export interface SubscriptionEvent {
  eventId: string;
  eventType: string;
  wordpressUserId: number;
  active: boolean;
  memberships: WordPressMembership[];
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface ConversationContext {
  conversationId: string;
  turns: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface KnowledgeHit {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
  authorityLayer: "A" | "B" | "C" | "D" | "E" | "F";
  content: string;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  messages: ModelMessage[];
  maxOutputTokens: number;
}

export interface ModelResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TranscriptionResult {
  text: string;
  model: string;
}

export interface VisionRequest {
  image: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
  prompt: string;
  maxOutputTokens: number;
}

export interface VisionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ChatReply {
  text: string;
  sources: KnowledgeHit[];
}

export interface SupportReply {
  text: string;
  plans: MembershipPlan[];
}
