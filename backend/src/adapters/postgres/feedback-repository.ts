import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { FeedbackRepository } from "../../domain/feedback-ports.js";

export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    subscriberId: string;
    requestId: string | null;
    category: "helpful" | "unclear" | "incorrect" | "safety" | "other";
    message: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO feedback_reports (
         id, subscriber_id, request_id, category, message
       ) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), input.subscriberId, input.requestId, input.category, input.message],
    );
  }

  async list(limit: number, offset: number): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT id, subscriber_id, request_id, category, message, status,
              admin_note, created_at, updated_at
       FROM feedback_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async updateStatus(
    id: string,
    status: "new" | "reviewing" | "resolved",
    note: string | null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE feedback_reports SET status=$2, admin_note=$3, updated_at=now()
       WHERE id=$1`,
      [id, status, note],
    );
  }
}

