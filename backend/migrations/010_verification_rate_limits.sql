CREATE TABLE IF NOT EXISTS verification_rate_limits (
  interface_kind text NOT NULL,
  external_user_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('request_code', 'verify_code')),
  attempts integer NOT NULL CHECK (attempts > 0),
  window_started_at timestamptz NOT NULL,
  PRIMARY KEY (interface_kind, external_user_id, action)
);
