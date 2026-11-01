import type { Pool } from "pg";
import type { RetentionRepository } from "../../domain/retention-service.js";

export class PostgresRetentionRepository implements RetentionRepository {
  constructor(private readonly pool: Pool) {}

  async purgeBefore(cutoff: Date): Promise<{ messages: number; answers: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const messages = await client.query(
        "DELETE FROM messages WHERE created_at < $1",
        [cutoff],
      );
      const answers = await client.query(
        "DELETE FROM answer_audits WHERE created_at < $1",
        [cutoff],
      );
      await client.query("COMMIT");
      return {
        messages: messages.rowCount ?? 0,
        answers: answers.rowCount ?? 0,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

