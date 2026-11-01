ALTER TABLE knowledge_sources
  ADD COLUMN IF NOT EXISTS managed_content text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE knowledge_sources source
SET managed_content = (
  SELECT string_agg(chunk.content, E'\n\n' ORDER BY chunk.chunk_index, chunk.created_at)
  FROM knowledge_chunks chunk
  WHERE chunk.source_id = source.id
    AND chunk.approval_status <> 'superseded'
)
WHERE source.managed_content IS NULL;

-- The owner confirmed the supplied teaching library as pre-approved. Unresolved
-- canonical decisions remain excluded because they are not established teaching.
UPDATE knowledge_chunks
SET approval_status = 'approved',
    retrieval_permission = 'production_teaching'
WHERE approval_status = 'validation_required'
  AND content_type <> 'unresolved';

UPDATE knowledge_sources source
SET approval_status = 'approved',
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM knowledge_chunks chunk
  WHERE chunk.source_id = source.id
    AND chunk.approval_status = 'approved'
);
