export interface InterfaceIdentity {
  interfaceKind: "telegram";
  externalUserId: string;
  displayName?: string;
  username?: string;
}

export interface ChatSource {
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
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

export interface ChatResponse {
  text: string;
  sources: ChatSource[];
}
