CREATE TABLE IF NOT EXISTS feedback_reports (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  request_id text,
  category text NOT NULL CHECK (category IN ('helpful', 'unclear', 'incorrect', 'safety', 'other')),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_reports_created_idx
  ON feedback_reports (created_at DESC);

