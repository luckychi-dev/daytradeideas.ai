-- Reconcile the blanket promotion in migration 011 with the reviewed source plan.
-- Core teaching modules remain canonical-rule subordinate; staged controls,
-- scripts, case studies and marketing claims stay admin-only until approved.

UPDATE knowledge_sources source
SET approval_status = 'approved',
    updated_at = now()
WHERE source.title = 'Day Trade Ideas Canonical Rule Matrix'
   OR source.module_code IN ('KB01', 'KB02', 'KB03', 'KB04', 'KB05', 'KB06');

UPDATE knowledge_sources source
SET approval_status = 'validation_required',
    updated_at = now()
WHERE source.source_path LIKE
      'Day_Trade_Ideas_AI_Knowledge_Base_Release_Candidate_v1.0/%'
  AND source.module_code IN ('CONTROL', 'KB07', 'KB08', 'KB10');

UPDATE knowledge_chunks chunk
SET approval_status = 'approved',
    retrieval_permission = 'production_teaching'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND chunk.content_type <> 'unresolved'
  AND (
    source.title = 'Day Trade Ideas Canonical Rule Matrix'
    OR source.module_code IN ('KB01', 'KB02', 'KB03', 'KB04', 'KB05', 'KB06')
  );

UPDATE knowledge_chunks chunk
SET approval_status = 'validation_required',
    retrieval_permission = 'admin_only'
FROM knowledge_sources source
WHERE source.id = chunk.source_id
  AND source.source_path LIKE
      'Day_Trade_Ideas_AI_Knowledge_Base_Release_Candidate_v1.0/%'
  AND source.module_code IN ('CONTROL', 'KB07', 'KB08', 'KB10');
