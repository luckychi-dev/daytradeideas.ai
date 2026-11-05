import type { Pool } from "pg";
import type { KnowledgeRetriever } from "../../domain/ports.js";
import type { KnowledgeHit } from "../../domain/types.js";
import {
  groupKnowledgeCandidates,
  mergeExpandedKnowledge,
  type RankedKnowledgeRow,
  type StoredKnowledgeRow,
} from "./knowledge-retrieval-selection.js";

const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "do", "does", "explain", "for", "how",
  "i", "in", "is", "it", "me", "my", "of", "on", "please", "that", "the",
  "this", "to", "what", "with", "you", "your",
]);

const MATCH_QUERY = `
  setweight(to_tsvector(
    'simple',
    replace(source.title, '_', ' ') || ' ' || source.module_code
  ), 'A') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(chunk.topic_tags, ' '), '')), 'B') ||
  chunk.search_vector`;

function termsFor(query: string): string[] {
  return [...new Set(
    (query.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? [])
      .filter((term) => !SEARCH_STOP_WORDS.has(term))
      .slice(0, 16),
  )];
}

function toHit(row: StoredKnowledgeRow): KnowledgeHit {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    sourceVersion: row.sourceVersion,
    locator: row.locator,
    authorityLayer: row.authorityLayer,
    content: row.content,
  };
}

export class PostgresKnowledgeRepository implements KnowledgeRetriever {
  constructor(private readonly pool: Pool) {}

  async search(query: string, limit: number): Promise<KnowledgeHit[]> {
    const terms = termsFor(query);
    if (terms.length === 0) return [];
    const tsQuery = terms.join(" | ");
    const candidateLimit = Math.max(limit * 4, 24);
    const candidates = await this.pool.query<RankedKnowledgeRow>(
      `WITH query AS (SELECT to_tsquery('simple', $1) AS value)
       SELECT
         chunk.id,
         source.id AS "sourceId",
         source.title AS "sourceTitle",
         source.version AS "sourceVersion",
         chunk.locator,
         chunk.authority_layer AS "authorityLayer",
         chunk.content,
         coalesce(chunk.chunk_index, 0) AS "chunkIndex",
         ts_rank_cd(${MATCH_QUERY}, query.value) AS score
       FROM knowledge_chunks chunk
       JOIN knowledge_sources source ON source.id = chunk.source_id
       CROSS JOIN query
       WHERE chunk.approval_status = 'approved'
         AND source.approval_status = 'approved'
         AND chunk.retrieval_permission = 'production_teaching'
         AND (${MATCH_QUERY}) @@ query.value
       ORDER BY
         score DESC,
         chunk.authority_layer ASC,
         chunk.chunk_index ASC NULLS LAST
       LIMIT $2`,
      [tsQuery, candidateLimit],
    );
    const groups = groupKnowledgeCandidates(candidates.rows, terms);
    if (groups.length === 0) return [];
    const expansions = await Promise.all(
      groups.slice(0, 2).map(async (group) => {
        const rows = await this.pool.query<StoredKnowledgeRow>(
          `SELECT
             chunk.id,
             source.id AS "sourceId",
             source.title AS "sourceTitle",
             source.version AS "sourceVersion",
             chunk.locator,
             chunk.authority_layer AS "authorityLayer",
             chunk.content,
             coalesce(chunk.chunk_index, 0) AS "chunkIndex"
           FROM knowledge_chunks chunk
           JOIN knowledge_sources source ON source.id = chunk.source_id
           WHERE chunk.source_id = $1
             AND chunk.approval_status = 'approved'
             AND source.approval_status = 'approved'
             AND chunk.retrieval_permission = 'production_teaching'
           ORDER BY
             CASE WHEN $4::boolean THEN
               CASE WHEN coalesce(chunk.chunk_index, -1) = ANY($2::int[])
                 THEN 0 ELSE 1 END
               ELSE 0
             END ASC,
             CASE WHEN $4::boolean THEN
               CASE WHEN coalesce(chunk.chunk_index, -1) = ANY($2::int[])
                 THEN array_position($2::int[], chunk.chunk_index)
                 ELSE coalesce(chunk.chunk_index, 2147483647)
               END
               ELSE (
                 SELECT min(abs(
                   coalesce(chunk.chunk_index, 0) - candidate.index
                 ))
                 FROM unnest($2::int[]) AS candidate(index)
               )
             END ASC,
             coalesce(chunk.chunk_index, 2147483647) ASC
           LIMIT $3`,
          [
            group.sourceId,
            group.titleMatch
              ? group.rows.slice(0, 4).map((row) => row.chunkIndex)
              : group.chunkIndexes,
            limit,
            group.titleMatch,
          ],
        );
        return rows.rows;
      }),
    );
    return mergeExpandedKnowledge(groups, expansions, limit).map(toHit);
  }
}
