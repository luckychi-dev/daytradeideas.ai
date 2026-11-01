# Knowledge ingestion

## Source of truth

The release-candidate folder remains unchanged:

`Day_Trade_Ideas_AI_Knowledge_Base_Release_Candidate_v1.0/`

The controlled ingestion plan is in
`backend/src/knowledge/source-plan.ts`. Only explicitly listed sources are
read. Developer specifications and QA trackers are not treated as mentor
knowledge.

## Promotion policy

- The canonical rule matrix is the only source currently producing
  production-eligible chunks.
- A canonical row marked `Confirmed` is ingested as `approved` and
  `production_teaching`.
- Canonical gaps and unresolved decisions are stored as
  `validation_required` and `admin_only`.
- Master instructions, behaviour specifications, and teaching modules are
  staged as `validation_required` and `admin_only`.
- The podcast quarantine and original source material are not ingested yet.
- Historical market levels, marketing claims, and guest views must never enter
  ordinary retrieval without their specific approval controls.

## Commands

```sh
pnpm db:migrate
pnpm ingest:staging
```

Ingestion is idempotent. Stable chunk IDs combine the source key, chunk index,
and content hash. A changed chunk receives a new ID, while older chunks are
marked `superseded` rather than deleted.

Each run is recorded in `ingestion_runs`. Sources and chunks retain paths,
checksums, authority layer, approval status, retrieval permission, topic tags,
rule IDs, and source locators.

## Retrieval boundary

`PostgresKnowledgeRepository` queries only rows where both the source and chunk
are approved and the chunk is permitted for production teaching. Candidate
content remains visible to future admin tooling but is unavailable to
subscribers.

## Remaining work

- Build an approval interface or CLI for promoting reviewed chunks.
- OCR the five image/vector-only PDFs before exact page-level ingestion.
- Add embeddings only after choosing an embedding provider and preserving the
  current lexical fallback.
- Run the retrieval acceptance tests against the actual answer pipeline.

