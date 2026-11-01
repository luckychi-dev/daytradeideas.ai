import type { Pool } from "pg";
import type { AdminRepository } from "../../domain/admin-ports.js";
import type {
  AdminAnalysis,
  AdminAuditRecord,
  AdminOverview,
  AdminSubscriber,
} from "../../domain/admin-types.js";
import { loadAdminAnalysis } from "./admin-analysis.js";
import { listAdminAudit, writeAdminAudit } from "./admin-audit.js";
import {
  approveAdminChunk,
  listAdminAnswers,
  listAdminKnowledge,
  listAdminSubscriptionEvents,
  listAdminUsage,
} from "./admin-content.js";
import { loadAdminOverview } from "./admin-overview.js";
import {
  deleteAdminSubscriber,
  listAdminSubscribers,
  unlinkAdminSubscriber,
  updateAdminSubscriberStatus,
} from "./admin-subscribers.js";

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly pool: Pool) {}

  overview(): Promise<AdminOverview> {
    return loadAdminOverview(this.pool);
  }

  listSubscribers(input: {
    search: string;
    status?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<AdminSubscriber[]> {
    return listAdminSubscribers(this.pool, input);
  }

  updateSubscriberStatus(id: string, status: "active" | "suspended"): Promise<void> {
    return updateAdminSubscriberStatus(this.pool, id, status);
  }

  unlinkSubscriber(id: string): Promise<void> {
    return unlinkAdminSubscriber(this.pool, id);
  }

  deleteSubscriber(id: string): Promise<void> {
    return deleteAdminSubscriber(this.pool, id);
  }

  listAnswers(limit: number, offset: number): Promise<Record<string, unknown>[]> {
    return listAdminAnswers(this.pool, limit, offset);
  }

  listUsage(limit: number, offset: number): Promise<Record<string, unknown>[]> {
    return listAdminUsage(this.pool, limit, offset);
  }

  listKnowledge(
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Record<string, unknown>[]> {
    return listAdminKnowledge(this.pool, status, limit, offset);
  }

  approveChunk(id: string, approved: boolean): Promise<void> {
    return approveAdminChunk(this.pool, id, approved);
  }

  audit(record: AdminAuditRecord): Promise<void> {
    return writeAdminAudit(this.pool, record);
  }

  listAudit(limit: number, offset: number): Promise<Record<string, unknown>[]> {
    return listAdminAudit(this.pool, limit, offset);
  }

  listSubscriptionEvents(
    limit: number,
    offset: number,
  ): Promise<Record<string, unknown>[]> {
    return listAdminSubscriptionEvents(this.pool, limit, offset);
  }

  analyzeAnswers(periodDays: number): Promise<AdminAnalysis> {
    return loadAdminAnalysis(this.pool, periodDays);
  }
}
