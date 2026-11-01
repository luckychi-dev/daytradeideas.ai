import type { PoolClient } from "pg";
import type {
  KnowledgeAuthorityLayer,
  KnowledgeDocumentSummary,
  KnowledgeDocumentWrite,
} from "../../domain/admin-knowledge-types.js";

export interface SummaryRow {
  id: string;
  title: string;
  version: string;
  module_code: string;
  author_or_speaker: string | null;
  approval_status: string;
  authority_layer: string | null;
  content_type: string | null;
  chunk_count: string;
  content_length: string | null;
  source_file: string | null;
  updated_at: Date;
}

export interface DocumentRow extends SummaryRow {
  content: string | null;
  topic_tags: string[] | null;
}

export const summarySelect = `
  s.id, s.title, s.version, s.module_code, s.author_or_speaker,
  s.approval_status, min(c.authority_layer) AS authority_layer,
  min(c.content_type) AS content_type,
  count(c.id) FILTER (WHERE c.approval_status <> 'superseded')::text AS chunk_count,
  coalesce(
    length(s.managed_content),
    sum(length(c.content)) FILTER (WHERE c.approval_status <> 'superseded'),
    0
  )::text AS content_length,
  coalesce(s.original_filename, s.source_path) AS source_file,
  s.updated_at`;

function authority(value: string | null): KnowledgeAuthorityLayer {
  return value && /^[A-F]$/.test(value) ? value as KnowledgeAuthorityLayer : "B";
}

export function summary(row: SummaryRow): KnowledgeDocumentSummary {
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    moduleCode: row.module_code,
    authorOrSpeaker: row.author_or_speaker,
    authorityLayer: authority(row.authority_layer),
    contentType: row.content_type ?? "knowledge",
    approvalStatus: row.approval_status,
    chunkCount: Number(row.chunk_count),
    contentLength: Number(row.content_length ?? 0),
    sourceFile: row.source_file,
    updatedAt: row.updated_at,
  };
}

export function isConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "23505";
}

export async function insertChunks(
  client: PoolClient,
  sourceId: string,
  input: KnowledgeDocumentWrite,
): Promise<void> {
  for (const chunk of input.chunks) {
    await client.query(
      `INSERT INTO knowledge_chunks (
         id, source_id, locator, authority_layer, content_type,
         approval_status, retrieval_permission, topic_tags, rule_ids,
         content, chunk_index, content_sha256, metadata, ingested_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'approved', 'production_teaching',
         $5, $6, $7, $8, $9, $10, now()
       )`,
      [
        sourceId,
        chunk.locator,
        chunk.authorityLayer,
        chunk.contentType,
        chunk.topicTags,
        chunk.ruleIds,
        chunk.content,
        chunk.chunkIndex,
        input.contentHash,
        JSON.stringify(chunk.metadata),
      ],
    );
  }
}
