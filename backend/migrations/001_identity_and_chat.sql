CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS subscribers (
  id uuid PRIMARY KEY,
  interface_kind text NOT NULL CHECK (interface_kind IN ('telegram', 'web', 'mobile', 'whatsapp')),
  external_user_id text NOT NULL,
  display_name text,
  username text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interface_kind, external_user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  interface_kind text NOT NULL CHECK (interface_kind IN ('telegram', 'web', 'mobile', 'whatsapp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, interface_kind)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_subscriber_created_idx
  ON usage_events (subscriber_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_settings (
  subscriber_id uuid PRIMARY KEY REFERENCES subscribers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  consent_version text,
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

