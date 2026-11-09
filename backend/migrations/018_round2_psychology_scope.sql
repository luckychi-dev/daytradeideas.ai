-- KB05 v0.3 consolidates the psychology extraction and removes pre-entry
-- stop-method language that conflicts with the Round 2 methodology.
UPDATE knowledge_chunks chunk
SET approval_status = 'superseded'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND source.module_code = 'KB05'
  AND source.version <> '0.3'
  AND chunk.approval_status <> 'superseded';

UPDATE knowledge_sources
SET approval_status = 'superseded',
    updated_at = now()
WHERE module_code = 'KB05'
  AND version <> '0.3'
  AND approval_status <> 'superseded';
