import type { Pool } from "pg";
import type {
  IdempotencyRepository,
  IdempotencySnapshot,
} from "../../domain/idempotency-ports.js";

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly pool: Pool) {}

  async begin(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
  ): Promise<IdempotencySnapshot> {
    const inserted = await this.pool.query(
      `INSERT INTO request_idempotency (
         interface_kind, external_user_id, request_id, status
       ) VALUES ($1, $2, $3, 'processing')
       ON CONFLICT DO NOTHING`,
      [interfaceKind, externalUserId, requestId],
    );
    if (inserted.rowCount === 1) return { status: "new" };
    const existing = await this.pool.query<{
      status: "processing" | "completed";
      response: unknown;
      stale: boolean;
    }>(
      `SELECT status, response, updated_at < now() - interval '10 minutes' AS stale
       FROM request_idempotency
       WHERE interface_kind = $1 AND external_user_id = $2 AND request_id = $3`,
      [interfaceKind, externalUserId, requestId],
    );
    const row = existing.rows[0];
    if (!row) return { status: "new" };
    if (row.status === "completed") {
      return { status: "completed", response: row.response };
    }
    if (!row.stale) return { status: "processing" };
    await this.pool.query(
      `UPDATE request_idempotency
       SET status = 'processing', response = NULL, updated_at = now()
       WHERE interface_kind = $1 AND external_user_id = $2 AND request_id = $3`,
      [interfaceKind, externalUserId, requestId],
    );
    return { status: "new" };
  }

  async complete(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
    response: unknown,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE request_idempotency
       SET status = 'completed', response = $4::jsonb, updated_at = now()
       WHERE interface_kind = $1 AND external_user_id = $2 AND request_id = $3`,
      [interfaceKind, externalUserId, requestId, JSON.stringify(response)],
    );
  }

  async fail(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM request_idempotency
       WHERE interface_kind = $1 AND external_user_id = $2 AND request_id = $3`,
      [interfaceKind, externalUserId, requestId],
    );
  }
}

