import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { UsageRepository } from "../../domain/ports.js";
import type { DailyUsage, UsageEvent } from "../../domain/usage-types.js";

export class PostgresUsageRepository implements UsageRepository {
  constructor(private readonly pool: Pool) {}

  async record(event: UsageEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO usage_events (
         id, subscriber_id, request_id, model, provider, usage_type,
         input_tokens, output_tokens, duration_seconds, estimated_cost_usd
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        event.subscriberId,
        event.requestId,
        event.model,
        event.provider,
        event.usageType,
        event.inputTokens,
        event.outputTokens,
        event.durationSeconds ?? null,
        event.estimatedCostUsd,
      ],
    );
  }

  async monthlySpendUsd(): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0)::text AS total
       FROM usage_events
       WHERE created_at >= date_trunc('month', now())`,
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async dailyUsage(subscriberId: string, since: Date): Promise<DailyUsage> {
    const result = await this.pool.query<{
      requests: string;
      voice_seconds: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE usage_type = 'chat')::text AS requests,
         COALESCE(SUM(duration_seconds) FILTER (
           WHERE usage_type IN ('transcription', 'synthesis')
         ), 0)::text
           AS voice_seconds
       FROM usage_events
       WHERE subscriber_id = $1 AND created_at >= $2`,
      [subscriberId, since],
    );
    return {
      requests: Number(result.rows[0]?.requests ?? 0),
      voiceSeconds: Number(result.rows[0]?.voice_seconds ?? 0),
    };
  }
}
