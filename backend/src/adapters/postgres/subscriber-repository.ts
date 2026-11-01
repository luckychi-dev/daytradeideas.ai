import type { Pool } from "pg";
import type { SubscriberRepository } from "../../domain/ports.js";
import type {
  InterfaceKind,
  Subscriber,
  SubscriberIdentity,
  WordPressMembership,
} from "../../domain/types.js";

interface SubscriberRow {
  id: string;
  interface_kind: InterfaceKind;
  external_user_id: string;
  display_name: string | null;
  status: "pending" | "active" | "suspended";
  verified_email: string | null;
  wordpress_user_id: string | null;
  membership_status: string | null;
  access_expires_at: Date | null;
  last_verified_at: Date | null;
}

function toSubscriber(row: SubscriberRow): Subscriber {
  return {
    id: row.id,
    interfaceKind: row.interface_kind,
    externalUserId: row.external_user_id,
    displayName: row.display_name,
    status: row.status,
    verifiedEmail: row.verified_email,
    wordpressUserId: row.wordpress_user_id ? Number(row.wordpress_user_id) : null,
    membershipStatus: row.membership_status,
    accessExpiresAt: row.access_expires_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

const selectedColumns = `id, interface_kind, external_user_id, display_name, status,
  verified_email, wordpress_user_id, membership_status, access_expires_at, last_verified_at`;

export class PostgresSubscriberRepository implements SubscriberRepository {
  constructor(private readonly pool: Pool) {}

  async activate(identity: SubscriberIdentity): Promise<Subscriber> {
    const result = await this.pool.query<SubscriberRow>(
      `INSERT INTO subscribers (
         id, interface_kind, external_user_id, display_name, username
       ) VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (interface_kind, external_user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         username = EXCLUDED.username,
         status = CASE WHEN subscribers.status = 'suspended' THEN 'suspended' ELSE 'active' END,
         updated_at = now()
       RETURNING ${selectedColumns}`,
      [
        identity.interfaceKind,
        identity.externalUserId,
        identity.displayName ?? null,
        identity.username ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Subscriber activation returned no row.");
    return toSubscriber(row);
  }

  async ensure(identity: SubscriberIdentity): Promise<Subscriber> {
    const result = await this.pool.query<SubscriberRow>(
      `INSERT INTO subscribers (
         id, interface_kind, external_user_id, display_name, username, status
       ) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending')
       ON CONFLICT (interface_kind, external_user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         username = EXCLUDED.username,
         updated_at = now()
       RETURNING ${selectedColumns}`,
      [
        identity.interfaceKind,
        identity.externalUserId,
        identity.displayName ?? null,
        identity.username ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Subscriber ensure returned no row.");
    return toSubscriber(row);
  }

  async find(interfaceKind: InterfaceKind, externalUserId: string): Promise<Subscriber | null> {
    const result = await this.pool.query<SubscriberRow>(
      `SELECT ${selectedColumns} FROM subscribers
       WHERE interface_kind = $1 AND external_user_id = $2`,
      [interfaceKind, externalUserId],
    );
    const row = result.rows[0];
    return row ? toSubscriber(row) : null;
  }

  async findActive(
    interfaceKind: InterfaceKind,
    externalUserId: string,
  ): Promise<Subscriber | null> {
    const result = await this.pool.query<SubscriberRow>(
      `SELECT ${selectedColumns}
       FROM subscribers
       WHERE interface_kind = $1 AND external_user_id = $2
         AND status = 'active'
         AND (access_expires_at IS NULL OR access_expires_at > now())`,
      [interfaceKind, externalUserId],
    );
    const row = result.rows[0];
    return row ? toSubscriber(row) : null;
  }

  async linkAccess(
    subscriberId: string,
    email: string,
    wordpressUserId: number,
    memberships: WordPressMembership[],
  ): Promise<void> {
    await this.pool.query(
      `UPDATE subscribers SET
         verified_email = $2,
         wordpress_user_id = $3,
         membership_status = $4,
         status = $5,
         access_expires_at = NULL,
         last_verified_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [
        subscriberId,
        email,
        wordpressUserId,
        memberships.length > 0 ? "wcm-active" : "inactive",
        memberships.length > 0 ? "active" : "pending",
      ],
    );
  }

  async unbind(interfaceKind: InterfaceKind, externalUserId: string): Promise<void> {
    await this.pool.query(
      `UPDATE subscribers SET
         verified_email = NULL,
         wordpress_user_id = NULL,
         membership_status = NULL,
         status = 'pending',
         access_expires_at = NULL,
         updated_at = now()
       WHERE interface_kind = $1 AND external_user_id = $2`,
      [interfaceKind, externalUserId],
    );
  }

  async updateAccessByWordpressUserId(
    wordpressUserId: number,
    active: boolean,
    memberships: WordPressMembership[],
  ): Promise<void> {
    await this.pool.query(
      `UPDATE subscribers SET
         membership_status = $2,
         status = $3,
         access_expires_at = NULL,
         last_verified_at = now(),
         updated_at = now()
       WHERE wordpress_user_id = $1`,
      [
        wordpressUserId,
        memberships.length > 0 ? "wcm-active" : "inactive",
        active ? "active" : "suspended",
      ],
    );
  }

  async listLinkedWordpressUserIds(): Promise<number[]> {
    const result = await this.pool.query<{ wordpress_user_id: string }>(
      `SELECT DISTINCT wordpress_user_id FROM subscribers
       WHERE wordpress_user_id IS NOT NULL`,
    );
    return result.rows.map((row) => Number(row.wordpress_user_id));
  }
}
