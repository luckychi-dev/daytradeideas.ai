ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_status_check;
ALTER TABLE subscribers
  ADD CONSTRAINT subscribers_status_check
  CHECK (status IN ('pending', 'active', 'suspended'));

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS verified_email text,
  ADD COLUMN IF NOT EXISTS wordpress_user_id bigint,
  ADD COLUMN IF NOT EXISTS membership_status text,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_telegram_email_unique_idx
  ON subscribers (lower(verified_email))
  WHERE interface_kind = 'telegram' AND verified_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_telegram_wordpress_unique_idx
  ON subscribers (wordpress_user_id)
  WHERE interface_kind = 'telegram' AND wordpress_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  interface_kind text NOT NULL,
  external_user_id text NOT NULL,
  email text NOT NULL,
  state text NOT NULL CHECK (state IN ('awaiting_otp')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interface_kind, external_user_id)
);

CREATE TABLE IF NOT EXISTS subscription_events (
  event_id text PRIMARY KEY,
  wordpress_user_id bigint NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

