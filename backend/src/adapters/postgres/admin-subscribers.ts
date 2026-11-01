import type { Pool } from "pg";
import type { AdminSubscriber } from "../../domain/admin-types.js";

export async function listAdminSubscribers(
  pool: Pool,
  input: { search: string; status?: string | undefined; limit: number; offset: number },
): Promise<AdminSubscriber[]> {
  const result = await pool.query(
    `SELECT id, interface_kind, external_user_id, display_name, status,
            verified_email, wordpress_user_id, membership_status,
            last_verified_at, created_at
     FROM subscribers
     WHERE ($1 = '' OR display_name ILIKE '%' || $1 || '%'
       OR verified_email ILIKE '%' || $1 || '%' OR external_user_id = $1)
       AND ($2 = '' OR status = $2)
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [input.search, input.status ?? "", input.limit, input.offset],
  );
  return result.rows.map((row) => ({
    id: row.id,
    interfaceKind: row.interface_kind,
    externalUserId: row.external_user_id,
    displayName: row.display_name,
    status: row.status,
    verifiedEmail: row.verified_email,
    wordpressUserId: row.wordpress_user_id ? Number(row.wordpress_user_id) : null,
    membershipStatus: row.membership_status,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
  }));
}

export async function updateAdminSubscriberStatus(
  pool: Pool,
  id: string,
  status: "active" | "suspended",
): Promise<void> {
  await pool.query("UPDATE subscribers SET status=$2, updated_at=now() WHERE id=$1", [
    id,
    status,
  ]);
}

export async function unlinkAdminSubscriber(pool: Pool, id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ interface_kind: string; external_user_id: string }>(
      "SELECT interface_kind, external_user_id FROM subscribers WHERE id=$1",
      [id],
    );
    const row = result.rows[0];
    if (row) {
      await client.query(
        "DELETE FROM auth_sessions WHERE interface_kind=$1 AND external_user_id=$2",
        [row.interface_kind, row.external_user_id],
      );
    }
    await client.query(
      `UPDATE subscribers SET verified_email=NULL, wordpress_user_id=NULL,
       membership_status=NULL, status='pending', access_expires_at=NULL,
       updated_at=now() WHERE id=$1`,
      [id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAdminSubscriber(pool: Pool, id: string): Promise<void> {
  await pool.query("DELETE FROM subscribers WHERE id=$1", [id]);
}
