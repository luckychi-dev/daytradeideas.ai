-- Migration 014 scoped CONTROL documents to admin-only but also caught the
-- canonical rule matrix because it shares the CONTROL module code.

UPDATE knowledge_sources
SET approval_status = 'approved',
    updated_at = now()
WHERE title = 'Day Trade Ideas Canonical Rule Matrix';

UPDATE knowledge_chunks chunk
SET approval_status = 'approved',
    retrieval_permission = 'production_teaching'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND source.title = 'Day Trade Ideas Canonical Rule Matrix'
  AND chunk.content_type <> 'unresolved';
