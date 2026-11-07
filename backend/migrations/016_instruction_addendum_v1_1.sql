-- Master Instructions v1.1 supersedes the v1.0 control specification.
-- Canonical rules, KB04 and KB06 are re-ingested as new versions after startup.

UPDATE knowledge_chunks chunk
SET approval_status = 'superseded'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND (
    source.title = 'Day_Trade_Ideas_AI_Master_Instructions_v1.0'
    OR source.title = 'Day Trade Ideas Canonical Rule Matrix'
    OR source.module_code IN ('KB04', 'KB06')
  )
  AND chunk.approval_status <> 'superseded';

UPDATE knowledge_sources
SET approval_status = 'superseded',
    updated_at = now()
WHERE title = 'Day_Trade_Ideas_AI_Master_Instructions_v1.0'
   OR title = 'Day Trade Ideas Canonical Rule Matrix'
   OR module_code IN ('KB04', 'KB06');
