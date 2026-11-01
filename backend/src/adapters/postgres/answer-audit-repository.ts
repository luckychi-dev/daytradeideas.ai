import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AnswerAuditRepository } from "../../domain/monitoring-ports.js";
import type { AnswerAuditRecord } from "../../domain/monitoring-types.js";

export class PostgresAnswerAuditRepository implements AnswerAuditRepository {
  constructor(private readonly pool: Pool) {}

  async record(audit: AnswerAuditRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO answer_audits (
         id, subscriber_id, request_id, question, answer, model, provider,
         source_ids, prompt_version, knowledge_version, rule_engine_version,
         rule_assessment, input_tokens, output_tokens, estimated_cost_usd, latency_ms
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         $12::jsonb, $13, $14, $15, $16
       )
       ON CONFLICT (subscriber_id, request_id) DO NOTHING`,
      [
        randomUUID(),
        audit.subscriberId,
        audit.requestId,
        audit.question,
        audit.answer,
        audit.model,
        audit.provider,
        audit.sourceIds,
        audit.promptVersion,
        audit.knowledgeVersion,
        audit.ruleEngineVersion,
        audit.ruleAssessment === undefined ? null : JSON.stringify(audit.ruleAssessment),
        audit.inputTokens,
        audit.outputTokens,
        audit.estimatedCostUsd,
        audit.latencyMs,
      ],
    );
  }
}
