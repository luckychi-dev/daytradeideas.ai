ALTER TABLE answer_audits
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS knowledge_version text NOT NULL DEFAULT 'release-candidate-1.0',
  ADD COLUMN IF NOT EXISTS rule_engine_version text NOT NULL DEFAULT '1.0.0';

CREATE INDEX IF NOT EXISTS subscription_events_received_idx
  ON subscription_events (received_at DESC);

