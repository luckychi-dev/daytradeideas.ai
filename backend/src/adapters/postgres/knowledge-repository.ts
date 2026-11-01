import type { Pool } from "pg";
import type { KnowledgeRetriever } from "../../domain/ports.js";
import type { KnowledgeHit } from "../../domain/types.js";

interface KnowledgeRow {
  id: string;
  source_id: string;
  source_title: string;
  source_version: string;
  locator: string;
  authority_layer: KnowledgeHit["authorityLayer"];
  content: string;
}

export class PostgresKnowledgeRepository implements KnowledgeRetriever {
  constructor(private readonly pool: Pool) {}

  async search(query: string, limit: number): Promise<KnowledgeHit[]> {
    const terms = [...new Set(
      (query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).slice(0, 16),
    )];
    if (terms.length === 0) return [];
    const tsQuery = terms.join(" | ");
    const result = await this.pool.query<KnowledgeRow>(
      `SELECT
         chunk.id,
         source.id AS source_id,
         source.title AS source_title,
         source.version AS source_version,
         chunk.locator,
         chunk.authority_layer,
         chunk.content
       FROM knowledge_chunks chunk
       JOIN knowledge_sources source ON source.id = chunk.source_id
       WHERE chunk.approval_status = 'approved'
         AND source.approval_status = 'approved'
         AND chunk.retrieval_permission = 'production_teaching'
         AND chunk.search_vector @@ to_tsquery('simple', $1)
       ORDER BY
         ts_rank_cd(chunk.search_vector, to_tsquery('simple', $1)) DESC,
         chunk.authority_layer ASC
       LIMIT $2`,
      [tsQuery, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      sourceTitle: row.source_title,
      sourceVersion: row.source_version,
      locator: row.locator,
      authorityLayer: row.authority_layer,
      content: row.content,
    }));
  }
}
