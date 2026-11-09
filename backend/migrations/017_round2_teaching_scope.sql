-- KB04 v0.3 is the Round 2 release for stop-method and source-discipline
-- corrections. Older approved KB04 versions must not remain retrievable.
UPDATE knowledge_chunks chunk
SET approval_status = 'superseded'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND source.module_code = 'KB04'
  AND source.version <> '0.3'
  AND chunk.approval_status <> 'superseded';

UPDATE knowledge_sources
SET approval_status = 'superseded',
    updated_at = now()
WHERE module_code = 'KB04'
  AND version <> '0.3'
  AND approval_status <> 'superseded';
