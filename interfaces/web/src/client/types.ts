export type AuthState =
  | "active"
  | "verification_required"
  | "awaiting_otp"
  | "inactive";

export interface ChatSource {
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  imageUrl?: string;
  sources?: ChatSource[];
  plans?: PlanLink[];
}

export interface PlanLink {
  productId: number;
  name: string;
  price: number;
  currency: string;
  billingPeriod: string;
  billingInterval: number;
  purchaseUrl: string;
}

export interface VerifyResult {
  verified: true;
  active: boolean;
  support?: {
    text: string;
    sources: ChatSource[];
    plans: PlanLink[];
  };
}

export interface SessionData {
  state: AuthState;
  telegramBotUrl: string;
}
