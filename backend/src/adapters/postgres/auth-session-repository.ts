import type { Pool } from "pg";
import type { AuthSessionRepository } from "../../domain/ports.js";
import type {
  AuthSession,
  InterfaceKind,
  WordPressMembership,
} from "../../domain/types.js";

export class PostgresAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly pool: Pool) {}

  async save(interfaceKind: InterfaceKind, externalUserId: string, email: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_sessions (
         interface_kind, external_user_id, email, state, expires_at
       ) VALUES ($1, $2, $3, 'awaiting_otp', now() + interval '10 minutes')
       ON CONFLICT (interface_kind, external_user_id) DO UPDATE SET
         email = EXCLUDED.email,
         state = 'awaiting_otp',
         expires_at = EXCLUDED.expires_at,
         updated_at = now()`,
      [interfaceKind, externalUserId, email],
    );
  }

  async get(interfaceKind: InterfaceKind, externalUserId: string): Promise<AuthSession | null> {
    const result = await this.pool.query<{
      email: string;
      expires_at: Date;
      state: AuthSession["state"];
      wordpress_user_id: string | null;
      memberships: WordPressMembership[];
    }>(
      `SELECT email, expires_at, state, wordpress_user_id, memberships
       FROM auth_sessions
       WHERE interface_kind = $1 AND external_user_id = $2
         AND expires_at > now()`,
      [interfaceKind, externalUserId],
    );
    const row = result.rows[0];
    return row
      ? {
          email: row.email,
          expiresAt: row.expires_at,
          state: row.state,
          wordpressUserId: row.wordpress_user_id ? Number(row.wordpress_user_id) : null,
          memberships: row.memberships,
        }
      : null;
  }

  async markClaimable(
    interfaceKind: InterfaceKind,
    externalUserId: string,
    wordpressUserId: number,
    memberships: WordPressMembership[],
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE auth_sessions SET
         state = 'claimable',
         wordpress_user_id = $3,
         memberships = $4::jsonb,
         expires_at = $5,
         updated_at = now()
       WHERE interface_kind = $1 AND external_user_id = $2`,
      [interfaceKind, externalUserId, wordpressUserId, JSON.stringify(memberships), expiresAt],
    );
  }

  async clear(interfaceKind: InterfaceKind, externalUserId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM auth_sessions WHERE interface_kind = $1 AND external_user_id = $2",
      [interfaceKind, externalUserId],
    );
  }
}
