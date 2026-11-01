import type {
  AdminAnalysis,
  AdminAuditRecord,
  AdminOverview,
  AdminSubscriber,
  XaiPrepaidBalance,
} from "./admin-types.js";

export interface XaiBillingPort {
  getPrepaidBalance(): Promise<XaiPrepaidBalance | null>;
}

export interface AdminRepository {
  overview(): Promise<AdminOverview>;
  listSubscribers(input: {
    search: string;
    status?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<AdminSubscriber[]>;
  updateSubscriberStatus(id: string, status: "active" | "suspended"): Promise<void>;
  unlinkSubscriber(id: string): Promise<void>;
  deleteSubscriber(id: string): Promise<void>;
  listAnswers(limit: number, offset: number): Promise<Record<string, unknown>[]>;
  listUsage(limit: number, offset: number): Promise<Record<string, unknown>[]>;
  listKnowledge(status: string | undefined, limit: number, offset: number): Promise<Record<string, unknown>[]>;
  approveChunk(id: string, approved: boolean): Promise<void>;
  audit(record: AdminAuditRecord): Promise<void>;
  listAudit(limit: number, offset: number): Promise<Record<string, unknown>[]>;
  listSubscriptionEvents(limit: number, offset: number): Promise<Record<string, unknown>[]>;
  analyzeAnswers(periodDays: number): Promise<AdminAnalysis>;
}
