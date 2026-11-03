import type { Pool } from "pg";
import type {
  Subscriber,
  SubscriberIdentity,
  WordPressMembership,
} from "../../domain/types.js";
import {
  subscriberColumns,
  toSubscriber,
  type SubscriberRow,
} from "./subscriber-record.js";

export async function takeoverSubscriberAccess(
  pool: Pool,
  identity: SubscriberIdentity,
  subscriberId: string,
  email: string,
  wordpressUserId: number,
  memberships: WordPressMembership[],
): Promise<Subscriber> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`subscriber-takeover:${identity.interfaceKind}:${wordpressUserId}`],
    );
    await client.query(
      `UPDATE subscribers SET
         verified_email = NULL,
         wordpress_user_id = NULL,
         membership_status = NULL,
         status = 'pending',
         access_expires_at = NULL,
         updated_at = now()
       WHERE interface_kind = $1 AND wordpress_user_id = $2 AND id <> $3`,
      [identity.interfaceKind, wordpressUserId, subscriberId],
    );
    const result = await client.query<SubscriberRow>(
      `UPDATE subscribers SET
         verified_email = $2,
         wordpress_user_id = $3,
         membership_status = $4,
         status = $5,
         access_expires_at = NULL,
         last_verified_at = now(),
         updated_at = now()
       WHERE id = $1
       RETURNING ${subscriberColumns}`,
      [
        subscriberId,
        email,
        wordpressUserId,
        memberships.length > 0 ? "wcm-active" : "inactive",
        memberships.length > 0 ? "active" : "pending",
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Subscriber takeover returned no row.");
    await client.query("COMMIT");
    return toSubscriber(row);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
