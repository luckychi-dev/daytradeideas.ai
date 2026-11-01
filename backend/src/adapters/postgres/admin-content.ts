import type { Pool } from "pg";

export async function listAdminAnswers(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
     `SELECT id, subscriber_id, request_id, question, answer, model, provider,
            source_ids, prompt_version, knowledge_version, rule_engine_version,
            rule_assessment, input_tokens, output_tokens, estimated_cost_usd,
            latency_ms, created_at
     FROM answer_audits ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

export async function listAdminUsage(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT id, subscriber_id, request_id, model, provider, usage_type,
            input_tokens, output_tokens, duration_seconds, estimated_cost_usd, created_at
     FROM usage_events ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

export async function listAdminSubscriptionEvents(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT event_id, wordpress_user_id, event_type, payload, occurred_at, received_at
     FROM subscription_events ORDER BY received_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

export async function listAdminKnowledge(
  pool: Pool,
  status: string | undefined,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT c.id, c.source_id, s.title AS source_title, s.version,
            c.locator, c.authority_layer, c.content_type, c.approval_status,
            c.retrieval_permission, c.topic_tags, left(c.content, 500) AS content_preview
     FROM knowledge_chunks c JOIN knowledge_sources s ON s.id=c.source_id
     WHERE ($1 = '' OR c.approval_status=$1)
     ORDER BY c.ingested_at DESC NULLS LAST LIMIT $2 OFFSET $3`,
    [status ?? "", limit, offset],
  );
  return result.rows;
}

export async function approveAdminChunk(
  pool: Pool,
  id: string,
  approved: boolean,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ source_id: string }>(
      `UPDATE knowledge_chunks SET approval_status=$2,
       retrieval_permission=$3 WHERE id=$1 RETURNING source_id`,
      [id, approved ? "approved" : "rejected", approved ? "production_teaching" : "excluded"],
    );
    const sourceId = result.rows[0]?.source_id;
    if (sourceId && approved) {
      await client.query("UPDATE knowledge_sources SET approval_status='approved' WHERE id=$1", [
        sourceId,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
