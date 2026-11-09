# Knowledge ingestion

## Source of truth

The versioned knowledge folder remains unchanged:

`Day_Trade_Ideas_AI_Knowledge_Base_Release_Candidate_v1.0/`

The controlled ingestion plan is in
`backend/src/knowledge/source-plan.ts`. Only explicitly listed sources are
read. Developer specifications and QA trackers are not treated as mentor
knowledge. Canonical Rule Matrix v1.1 and approved KB04 v0.3 / KB05 v0.3 /
KB06 v0.4 are the Round 2 release sources.

## Promotion policy

- The canonical rule matrix and reviewed core teaching modules KB01-KB06
  produce production-eligible chunks.
- A canonical row marked `Confirmed` is ingested as `approved` and
  `production_teaching`.
- Canonical gaps and unresolved decisions are stored as
  `validation_required` and `admin_only`.
- Master instructions and other internal control specifications are staged
  as `validation_required` and `admin_only`.
- KB07 scripts, KB08 case studies and KB10 marketing claims remain
  `validation_required` and `admin_only` until their chunks receive specific
  approval.
- The podcast quarantine and original source material are not ingested yet.
- Historical market levels, marketing claims, and guest views must never enter
  ordinary retrieval without their specific approval controls.

## Commands

```sh
pnpm db:migrate
pnpm ingest:staging
RETRIEVAL_TEST_DATABASE_URL="$DATABASE_URL" pnpm --filter @daytrade/backend \
  test -- knowledge-retrieval-acceptance.test.ts
pnpm --filter @daytrade/backend accept:round2
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
subscribers. For a matching source, retrieval expands around the best chunk so
definitional or framework questions receive the surrounding approved section
instead of only the highest-ranked fragment.

## Release acceptance

F01 and F02 must pass independently in fresh conversations after the approved
knowledge has been ingested and the new build deployed. The retrieval
acceptance test verifies that the live database stores and selects the
approved switching-gap and Five Tools passages; it does not replace the live
model conversation checks.

## Remaining work

- Build an approval interface or CLI for promoting reviewed chunks.
- OCR the five image/vector-only PDFs before exact page-level ingestion.
- Add embeddings only after choosing an embedding provider and preserving the
  current lexical fallback.
