import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { ConversationRepository } from "../../domain/ports.js";
import type { ConversationContext, InterfaceKind } from "../../domain/types.js";

interface ConversationRow {
  id: string;
}

interface MessageRow {
  role: "user" | "assistant";
  content: string;
}

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly pool: Pool) {}

  async loadRecent(
    subscriberId: string,
    interfaceKind: InterfaceKind,
    limit: number,
  ): Promise<ConversationContext> {
    const conversationId = await this.getOrCreate(subscriberId, interfaceKind);
    const result = await this.pool.query<MessageRow>(
      `SELECT role, content
       FROM (
         SELECT role, content, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) recent
       ORDER BY created_at ASC`,
      [conversationId, limit],
    );
    return { conversationId, turns: result.rows };
  }

  async appendMessage(
    conversationId: string,
    subscriberId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO messages (id, conversation_id, role, content)
         SELECT $1, id, $3, $4
         FROM conversations
         WHERE id = $2 AND subscriber_id = $5`,
        [randomUUID(), conversationId, role, content, subscriberId],
      );
      if (inserted.rowCount !== 1) throw new Error("Conversation is outside tenant scope.");
      await client.query(
        `UPDATE conversations SET last_message_at = now()
         WHERE id = $1 AND subscriber_id = $2`,
        [conversationId, subscriberId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async getOrCreate(subscriberId: string, interfaceKind: InterfaceKind): Promise<string> {
    await this.pool.query(
      `INSERT INTO conversations (id, subscriber_id, interface_kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (subscriber_id, interface_kind) DO NOTHING`,
      [randomUUID(), subscriberId, interfaceKind],
    );
    const result = await this.pool.query<ConversationRow>(
      `SELECT id FROM conversations
       WHERE subscriber_id = $1 AND interface_kind = $2`,
      [subscriberId, interfaceKind],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Conversation creation returned no row.");
    return row.id;
  }
}
