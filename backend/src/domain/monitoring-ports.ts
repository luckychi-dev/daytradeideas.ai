import type { AnswerAuditRecord } from "./monitoring-types.js";

export interface AnswerAuditRepository {
  record(audit: AnswerAuditRecord): Promise<void>;
}

