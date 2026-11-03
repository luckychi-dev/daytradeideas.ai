ALTER TABLE auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_state_check;

ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_state_check
  CHECK (state IN ('awaiting_otp', 'claimable'));

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS wordpress_user_id bigint,
  ADD COLUMN IF NOT EXISTS memberships jsonb NOT NULL DEFAULT '[]'::jsonb;
