import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { KnowledgeChunkDraft, PlannedSource } from "./types.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value: string): string {
  const hash = sha256(value);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export interface IngestSourceInput {
  source: PlannedSource;
  fileHash: string;
  chunks: KnowledgeChunkDraft[];
}

export class IngestionStore {
  constructor(private readonly pool: Pool) {}

  async startRun(): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO ingestion_runs (id, status) VALUES ($1, 'running')",
      [id],
    );
    return id;
  }

  async finishRun(id: string, sourceCount: number, chunkCount: number): Promise<void> {
    await this.pool.query(
      `UPDATE ingestion_runs
       SET status = 'completed', completed_at = now(),
           source_count = $2, chunk_count = $3
       WHERE id = $1`,
      [id, sourceCount, chunkCount],
    );
  }

  async failRun(id: string, error: unknown): Promise<void> {
    const summary = error instanceof Error ? error.message.slice(0, 1000) : "Unknown error";
    await this.pool.query(
      `UPDATE ingestion_runs
       SET status = 'failed', completed_at = now(), error_summary = $2
       WHERE id = $1`,
      [id, summary],
    );
  }

  async ingestSource(input: IngestSourceInput): Promise<{ sourceId: string; chunks: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sourceId = await this.upsertSource(client, input);
      const chunkIds = await this.upsertChunks(client, sourceId, input);
      await client.query(
        `UPDATE knowledge_chunks SET approval_status = 'superseded'
         WHERE source_id = $1 AND NOT (id = ANY($2::uuid[]))`,
        [sourceId, chunkIds],
      );
      await client.query("COMMIT");
      return { sourceId, chunks: chunkIds.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertSource(client: PoolClient, input: IngestSourceInput): Promise<string> {
    const { source, fileHash } = input;
    const result = await client.query<{ id: string }>(
      `INSERT INTO knowledge_sources (
         id, title, version, module_code, author_or_speaker,
         approval_status, source_path, content_sha256, ingested_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (title, version) DO UPDATE SET
         module_code = EXCLUDED.module_code,
         author_or_speaker = EXCLUDED.author_or_speaker,
         approval_status = EXCLUDED.approval_status,
         source_path = EXCLUDED.source_path,
         content_sha256 = EXCLUDED.content_sha256,
         ingested_at = now()
       RETURNING id`,
      [
        randomUUID(),
        source.title,
        source.version,
        source.moduleCode,
        source.authorOrSpeaker,
        source.approvalStatus,
        source.relativePath,
        fileHash,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error(`Source upsert returned no ID: ${source.title}`);
    return id;
  }

  private async upsertChunks(
    client: PoolClient,
    sourceId: string,
    input: IngestSourceInput,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const chunk of input.chunks) {
      const contentHash = sha256(chunk.content);
      const id = deterministicUuid(`${input.source.key}:${chunk.chunkIndex}:${contentHash}`);
      ids.push(id);
      await client.query(
        `INSERT INTO knowledge_chunks (
           id, source_id, locator, authority_layer, content_type,
           approval_status, retrieval_permission, topic_tags, rule_ids,
           content, chunk_index, content_sha256, metadata, ingested_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
         )
         ON CONFLICT (id) DO UPDATE SET
           locator = EXCLUDED.locator,
           authority_layer = EXCLUDED.authority_layer,
           content_type = EXCLUDED.content_type,
           approval_status = EXCLUDED.approval_status,
           retrieval_permission = EXCLUDED.retrieval_permission,
           topic_tags = EXCLUDED.topic_tags,
           rule_ids = EXCLUDED.rule_ids,
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           ingested_at = now()`,
        [
          id,
          sourceId,
          chunk.locator,
          chunk.authorityLayer,
          chunk.contentType,
          chunk.approvalStatus,
          chunk.retrievalPermission,
          chunk.topicTags,
          chunk.ruleIds,
          chunk.content,
          chunk.chunkIndex,
          contentHash,
          JSON.stringify(chunk.metadata),
        ],
      );
    }
    return ids;
  }
}

