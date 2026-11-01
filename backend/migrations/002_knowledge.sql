CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  version text NOT NULL,
  module_code text NOT NULL,
  author_or_speaker text,
  approval_status text NOT NULL CHECK (
    approval_status IN (
      'ingested', 'extracted', 'attribution_checked', 'validation_required',
      'approved', 'restricted', 'superseded', 'rejected'
    )
  ),
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title, version)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  locator text NOT NULL,
  authority_layer char(1) NOT NULL CHECK (authority_layer IN ('A', 'B', 'C', 'D', 'E', 'F')),
  content_type text NOT NULL,
  approval_status text NOT NULL CHECK (
    approval_status IN (
      'ingested', 'extracted', 'attribution_checked', 'validation_required',
      'approved', 'restricted', 'superseded', 'rejected'
    )
  ),
  retrieval_permission text NOT NULL CHECK (
    retrieval_permission IN (
      'admin_only', 'production_teaching', 'historical_examples_only', 'excluded'
    )
  ),
  topic_tags text[] NOT NULL DEFAULT '{}',
  rule_ids text[] NOT NULL DEFAULT '{}',
  content text NOT NULL CHECK (length(content) > 0),
  embedding vector(1536),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_search_idx
  ON knowledge_chunks USING gin (search_vector);

CREATE INDEX IF NOT EXISTS knowledge_chunks_approval_idx
  ON knowledge_chunks (approval_status, retrieval_permission, authority_layer);

INSERT INTO knowledge_sources (
  id, title, version, module_code, author_or_speaker, approval_status
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Day Trade Ideas Canonical Rule Matrix',
  '1.0',
  'CONTROL',
  'Jason Sen / owner-confirmed',
  'approved'
) ON CONFLICT DO NOTHING;

INSERT INTO knowledge_chunks (
  id, source_id, locator, authority_layer, content_type,
  approval_status, retrieval_permission, topic_tags, rule_ids, content
) VALUES
(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'Behaviour contract / section 6 / RISK-001',
  'A', 'rule', 'approved', 'production_teaching',
  ARRAY['risk', 'reward-risk'], ARRAY['RISK-001'],
  'The minimum reward-to-risk ratio is 1.5:1. A setup below this minimum does not qualify.'
),
(
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000001',
  'Behaviour contract / section 6 / RISK-002',
  'A', 'rule', 'approved', 'production_teaching',
  ARRAY['risk', 'stop-loss'], ARRAY['RISK-002'],
  'A stop-loss order must be in place when the trade is executed. A mental stop is not sufficient.'
),
(
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000001',
  'Behaviour contract / section 6 / PSY-001',
  'A', 'rule', 'approved', 'production_teaching',
  ARRAY['psychology', 'no-trade'], ARRAY['PSY-001'],
  'Advise no new trades while the trader discloses severe stress, exhaustion, intoxication, emotional unsettlement, or an attempt to recover losses.'
)
ON CONFLICT DO NOTHING;

