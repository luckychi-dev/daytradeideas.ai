ALTER TABLE knowledge_sources
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS content_sha256 char(64),
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS content_sha256 char(64),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_source_index_content_idx
  ON knowledge_chunks (source_id, chunk_index, content_sha256)
  WHERE chunk_index IS NOT NULL AND content_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  error_summary text
);

