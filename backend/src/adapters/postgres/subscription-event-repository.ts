import type { Pool } from "pg";
import type { SubscriptionEventRepository } from "../../domain/ports.js";
import type { SubscriptionEvent } from "../../domain/types.js";

export class PostgresSubscriptionEventRepository implements SubscriptionEventRepository {
  constructor(private readonly pool: Pool) {}

  async apply(event: SubscriptionEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO subscription_events (
           event_id, wordpress_user_id, event_type, payload, occurred_at
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          event.eventId,
          event.wordpressUserId,
          event.eventType,
          JSON.stringify(event.payload),
          event.occurredAt,
        ],
      );
      if (inserted.rowCount === 1) {
        await client.query(
          `UPDATE subscribers SET
             membership_status = $2,
             status = $3,
             access_expires_at = NULL,
             last_verified_at = now(),
             updated_at = now()
           WHERE interface_kind = 'telegram'
             AND wordpress_user_id = $1
             AND (last_verified_at IS NULL OR last_verified_at <= $4)`,
          [
            event.wordpressUserId,
            event.memberships.length > 0 ? "wcm-active" : "inactive",
            event.active ? "active" : "suspended",
            event.occurredAt,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

