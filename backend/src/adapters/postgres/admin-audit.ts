import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AdminAuditRecord } from "../../domain/admin-types.js";

export async function writeAdminAudit(pool: Pool, record: AdminAuditRecord): Promise<void> {
  await pool.query(
    `INSERT INTO admin_audit_log (
       id, actor, action, target_type, target_id, details
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      record.actor,
      record.action,
      record.targetType,
      record.targetId,
      JSON.stringify(record.details),
    ],
  );
}

export async function listAdminAudit(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT id, actor, action, target_type, target_id, details, created_at
     FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

