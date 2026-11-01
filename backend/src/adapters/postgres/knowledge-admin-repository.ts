import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { KnowledgeAdminRepository } from "../../domain/admin-knowledge-ports.js";
import { KnowledgeDocumentConflictError } from "../../domain/admin-knowledge-service.js";
import type {
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  KnowledgeDocumentWrite,
} from "../../domain/admin-knowledge-types.js";
import {
  type DocumentRow,
  type SummaryRow,
  insertChunks,
  isConflict,
  summary,
  summarySelect,
} from "./knowledge-admin-store.js";

export class PostgresKnowledgeAdminRepository implements KnowledgeAdminRepository {
  constructor(private readonly pool: Pool) {}

  async listDocuments(): Promise<KnowledgeDocumentSummary[]> {
    const result = await this.pool.query<SummaryRow>(
      `SELECT ${summarySelect}
       FROM knowledge_sources s
       LEFT JOIN knowledge_chunks c ON c.source_id = s.id
       GROUP BY s.id
       ORDER BY s.updated_at DESC, s.title ASC`,
    );
    return result.rows.map(summary);
  }

  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    const result = await this.pool.query<DocumentRow>(
      `SELECT ${summarySelect},
         coalesce(
           s.managed_content,
           string_agg(c.content, E'\n\n' ORDER BY c.chunk_index NULLS LAST, c.created_at)
         ) AS content,
         coalesce((
           SELECT array_agg(DISTINCT tag ORDER BY tag)
           FROM knowledge_chunks tagged
           CROSS JOIN LATERAL unnest(tagged.topic_tags) AS tag
           WHERE tagged.source_id = s.id
             AND tagged.approval_status <> 'superseded'
         ), '{}') AS topic_tags
       FROM knowledge_sources s
       LEFT JOIN knowledge_chunks c
         ON c.source_id = s.id AND c.approval_status <> 'superseded'
       WHERE s.id = $1
       GROUP BY s.id`,
      [id],
    );
    const row = result.rows[0];
    return row ? {
      ...summary(row),
      content: row.content ?? "",
      topicTags: row.topic_tags ?? [],
    } : null;
  }

  async createDocument(input: KnowledgeDocumentWrite): Promise<KnowledgeDocument> {
    const client = await this.pool.connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO knowledge_sources (
           id, title, version, module_code, author_or_speaker,
           approval_status, source_path, content_sha256, ingested_at,
           managed_content, original_filename, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'approved', $6, $7, now(), $8, $9, now()
         )`,
        [
          id, input.title, input.version, input.moduleCode, input.authorOrSpeaker,
          `admin-upload/${input.sourceFile}`, input.contentHash, input.content, input.sourceFile,
        ],
      );
      await insertChunks(client, id, input);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (isConflict(error)) throw new KnowledgeDocumentConflictError();
      throw error;
    } finally {
      client.release();
    }
    const document = await this.getDocument(id);
    if (!document) throw new Error("Created knowledge document was not found.");
    return document;
  }

  async updateDocument(
    id: string,
    input: KnowledgeDocumentWrite,
  ): Promise<KnowledgeDocument | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE knowledge_sources SET
           title = $2, version = $3, module_code = $4, author_or_speaker = $5,
           approval_status = 'approved', source_path = $6, content_sha256 = $7,
           ingested_at = now(), managed_content = $8, original_filename = $9,
           updated_at = now()
         WHERE id = $1`,
        [
          id, input.title, input.version, input.moduleCode, input.authorOrSpeaker,
          `admin-upload/${input.sourceFile}`, input.contentHash, input.content, input.sourceFile,
        ],
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("DELETE FROM knowledge_chunks WHERE source_id = $1", [id]);
      await insertChunks(client, id, input);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (isConflict(error)) throw new KnowledgeDocumentConflictError();
      throw error;
    } finally {
      client.release();
    }
    return this.getDocument(id);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM knowledge_sources WHERE id = $1",
      [id],
    );
    return Boolean(result.rowCount);
  }
}
