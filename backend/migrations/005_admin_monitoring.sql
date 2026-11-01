ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(14, 6) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS runtime_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO runtime_settings (key, value) VALUES
  ('monthly_budget_usd', '20'::jsonb),
  ('daily_messages_per_subscriber', '60'::jsonb),
  ('daily_voice_seconds_per_subscriber', '600'::jsonb),
  ('trade_assessment_enabled', 'true'::jsonb),
  ('memory_enabled', 'false'::jsonb),
  ('message_retention_days', '365'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS answer_audits (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  model text NOT NULL,
  provider text NOT NULL,
  source_ids text[] NOT NULL DEFAULT '{}',
  rule_assessment jsonb,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(14, 6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, request_id)
);

CREATE INDEX IF NOT EXISTS answer_audits_created_idx
  ON answer_audits (created_at DESC);

CREATE TABLE IF NOT EXISTS request_idempotency (
  interface_kind text NOT NULL,
  external_user_id text NOT NULL,
  request_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interface_kind, external_user_id, request_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

