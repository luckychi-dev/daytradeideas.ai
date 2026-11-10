-- KB04 v0.4 and KB05 v0.4 contain the Round 3 source-discipline corrections.
-- Older versions must not remain available to subscriber retrieval.
UPDATE knowledge_chunks chunk
SET approval_status = 'superseded'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND source.module_code IN ('KB04', 'KB05')
  AND source.version <> '0.4'
  AND chunk.approval_status <> 'superseded';

UPDATE knowledge_sources
SET approval_status = 'superseded',
    updated_at = now()
WHERE module_code IN ('KB04', 'KB05')
  AND version <> '0.4'
  AND approval_status <> 'superseded';
