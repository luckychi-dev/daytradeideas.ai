import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { MemoryRepository } from "../../domain/memory-ports.js";
import type {
  MemoryCategory,
  MemoryItem,
  MemorySettings,
} from "../../domain/memory-types.js";

export class MemoryDisabledError extends Error {}

export class PostgresMemoryRepository implements MemoryRepository {
  constructor(private readonly pool: Pool) {}

  async settings(subscriberId: string): Promise<MemorySettings> {
    const result = await this.pool.query<{
      enabled: boolean;
      consent_version: string | null;
      consented_at: Date | null;
    }>(
      `SELECT enabled, consent_version, consented_at
       FROM memory_settings WHERE subscriber_id=$1`,
      [subscriberId],
    );
    const row = result.rows[0];
    return row
      ? {
          enabled: row.enabled && await this.isGloballyEnabled(),
          consentVersion: row.consent_version,
          consentedAt: row.consented_at,
        }
      : { enabled: false, consentVersion: null, consentedAt: null };
  }

  async enable(subscriberId: string, consentVersion: string): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO memory_settings (
         subscriber_id, enabled, consent_version, consented_at
       )
       SELECT $1, true, $2, now()
       WHERE (SELECT value FROM runtime_settings WHERE key='memory_enabled')='true'::jsonb
       ON CONFLICT (subscriber_id) DO UPDATE SET
         enabled=true, consent_version=$2, consented_at=now(), updated_at=now()
       RETURNING subscriber_id`,
      [subscriberId, consentVersion],
    );
    if (result.rowCount !== 1) throw new MemoryDisabledError();
  }

  async disable(subscriberId: string): Promise<void> {
    await this.pool.query(
      `UPDATE memory_settings SET enabled=false, updated_at=now()
       WHERE subscriber_id=$1`,
      [subscriberId],
    );
  }

  async items(subscriberId: string): Promise<MemoryItem[]> {
    const result = await this.pool.query<{
      id: string;
      category: MemoryCategory;
      content: string;
      origin: string;
      review_after: string | null;
      updated_at: Date;
    }>(
      `SELECT id, category, content, origin, review_after::text, updated_at
       FROM memory_items WHERE subscriber_id=$1 ORDER BY updated_at DESC`,
      [subscriberId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      category: row.category,
      content: row.content,
      origin: row.origin,
      reviewAfter: row.review_after,
      updatedAt: row.updated_at,
    }));
  }

  async upsert(input: {
    id?: string;
    subscriberId: string;
    category: MemoryCategory;
    content: string;
    origin: string;
    reviewAfter: string | null;
  }): Promise<MemoryItem> {
    const id = input.id ?? randomUUID();
    const result = await this.pool.query<{
      id: string;
      category: MemoryCategory;
      content: string;
      origin: string;
      review_after: string | null;
      updated_at: Date;
    }>(
      `INSERT INTO memory_items (
         id, subscriber_id, category, content, origin, review_after
       )
       SELECT $1, $2, $3, $4, $5, $6::date
       WHERE EXISTS (
         SELECT 1 FROM memory_settings WHERE subscriber_id=$2 AND enabled=true
       ) AND (
         SELECT value FROM runtime_settings WHERE key='memory_enabled'
       )='true'::jsonb
       ON CONFLICT (id) DO UPDATE SET
         category=EXCLUDED.category, content=EXCLUDED.content,
         origin=EXCLUDED.origin, review_after=EXCLUDED.review_after,
         updated_at=now()
       WHERE memory_items.subscriber_id=EXCLUDED.subscriber_id
       RETURNING id, category, content, origin, review_after::text, updated_at`,
      [id, input.subscriberId, input.category, input.content, input.origin, input.reviewAfter],
    );
    const row = result.rows[0];
    if (!row) throw new MemoryDisabledError();
    return {
      id: row.id,
      category: row.category,
      content: row.content,
      origin: row.origin,
      reviewAfter: row.review_after,
      updatedAt: row.updated_at,
    };
  }

  async removeItem(subscriberId: string, id: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM memory_items WHERE subscriber_id=$1 AND id=$2",
      [subscriberId, id],
    );
  }

  async clear(subscriberId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM memory_items WHERE subscriber_id=$1", [subscriberId]);
      await client.query(
        `UPDATE memory_settings SET enabled=false, updated_at=now()
         WHERE subscriber_id=$1`,
        [subscriberId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async activeContext(subscriberId: string): Promise<string | null> {
    const settings = await this.settings(subscriberId);
    if (!settings.enabled) return null;
    const items = await this.items(subscriberId);
    if (items.length === 0) return null;
    return items.map((item) => `${item.category}: ${item.content}`).join("\n");
  }

  private async isGloballyEnabled(): Promise<boolean> {
    const result = await this.pool.query<{ enabled: boolean }>(
      `SELECT value='true'::jsonb AS enabled
       FROM runtime_settings WHERE key='memory_enabled'`,
    );
    return result.rows[0]?.enabled ?? false;
  }
}
