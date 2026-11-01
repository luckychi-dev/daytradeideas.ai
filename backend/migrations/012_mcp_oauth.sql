CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expiry_idx
  ON mcp_oauth_codes (expires_at);

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  token_hash text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('access', 'refresh')),
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_expiry_idx
  ON mcp_oauth_tokens (expires_at);

CREATE TABLE IF NOT EXISTS mcp_rate_limits (
  limit_key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  window_started_at timestamptz NOT NULL
);
