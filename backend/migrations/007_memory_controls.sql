ALTER TABLE memory_settings
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS memory_items (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('preference', 'plan_setting', 'learning_goal', 'self_reported_habit')
  ),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  origin text NOT NULL,
  review_after date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_items_subscriber_idx
  ON memory_items (subscriber_id, updated_at DESC);

