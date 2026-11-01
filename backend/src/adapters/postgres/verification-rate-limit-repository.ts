import type { Pool } from "pg";
import type {
  VerificationRateLimitDecision,
  VerificationRateLimitRepository,
} from "../../domain/ports.js";
import type { InterfaceKind } from "../../domain/types.js";

export class PostgresVerificationRateLimitRepository
implements VerificationRateLimitRepository {
  constructor(private readonly pool: Pool) {}

  async consume(
    interfaceKind: InterfaceKind,
    externalUserId: string,
    action: "request_code" | "verify_code",
    limit: number,
    windowSeconds: number,
  ): Promise<VerificationRateLimitDecision> {
    const result = await this.pool.query<{
      attempts: number;
      retry_after_seconds: number;
    }>(
      `WITH limited AS (
         INSERT INTO verification_rate_limits (
           interface_kind, external_user_id, action, attempts, window_started_at
         ) VALUES ($1, $2, $3, 1, now())
         ON CONFLICT (interface_kind, external_user_id, action) DO UPDATE SET
           attempts = CASE
             WHEN verification_rate_limits.window_started_at <=
                  now() - ($4 * interval '1 second') THEN 1
             ELSE verification_rate_limits.attempts + 1
           END,
           window_started_at = CASE
             WHEN verification_rate_limits.window_started_at <=
                  now() - ($4 * interval '1 second') THEN now()
             ELSE verification_rate_limits.window_started_at
           END
         RETURNING attempts, window_started_at
       )
       SELECT attempts,
              GREATEST(
                0,
                CEIL(EXTRACT(EPOCH FROM (
                  window_started_at + ($4 * interval '1 second') - now()
                )))
              )::integer AS retry_after_seconds
       FROM limited`,
      [interfaceKind, externalUserId, action, windowSeconds],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Verification rate limit returned no row.");
    return {
      allowed: row.attempts <= limit,
      retryAfterSeconds: Number(row.retry_after_seconds),
    };
  }
}
