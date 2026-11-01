import type { Pool } from "pg";
import type { McpOAuthRepository } from "../../domain/mcp-oauth-ports.js";
import type {
  McpAuthorizationCode,
  McpOAuthClient,
  McpOAuthToken,
  McpRateLimitDecision,
  McpTokenKind,
} from "../../domain/mcp-oauth-types.js";

interface ClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

interface CodeRow {
  code_hash: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  resource: string;
  scopes: string[];
  subject: string;
  expires_at: Date;
}

interface TokenRow {
  token_hash: string;
  kind: McpTokenKind;
  client_id: string;
  resource: string;
  scopes: string[];
  subject: string;
  expires_at: Date;
}

function client(row: ClientRow): McpOAuthClient {
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: row.redirect_uris,
  };
}

function code(row: CodeRow): McpAuthorizationCode {
  return {
    codeHash: row.code_hash,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    resource: row.resource,
    scopes: row.scopes,
    subject: row.subject,
    expiresAt: row.expires_at,
  };
}

function token(row: TokenRow): McpOAuthToken {
  return {
    tokenHash: row.token_hash,
    kind: row.kind,
    clientId: row.client_id,
    resource: row.resource,
    scopes: row.scopes,
    subject: row.subject,
    expiresAt: row.expires_at,
  };
}

export class PostgresMcpOAuthRepository implements McpOAuthRepository {
  constructor(private readonly pool: Pool) {}

  async createClient(value: McpOAuthClient): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris)
       VALUES ($1, $2, $3)`,
      [value.clientId, value.clientName, value.redirectUris],
    );
  }

  async findClient(clientId: string): Promise<McpOAuthClient | null> {
    const result = await this.pool.query<ClientRow>(
      `SELECT client_id, client_name, redirect_uris
       FROM mcp_oauth_clients WHERE client_id = $1`,
      [clientId],
    );
    return result.rows[0] ? client(result.rows[0]) : null;
  }

  async consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<McpRateLimitDecision> {
    const result = await this.pool.query<{
      attempts: number;
      retry_after_seconds: number;
    }>(
      `WITH updated AS (
         INSERT INTO mcp_rate_limits (limit_key, attempts, window_started_at)
         VALUES ($1, 1, now())
         ON CONFLICT (limit_key) DO UPDATE SET
           attempts = CASE
             WHEN mcp_rate_limits.window_started_at <= now() - make_interval(secs => $2)
             THEN 1 ELSE mcp_rate_limits.attempts + 1 END,
           window_started_at = CASE
             WHEN mcp_rate_limits.window_started_at <= now() - make_interval(secs => $2)
             THEN now() ELSE mcp_rate_limits.window_started_at END
         RETURNING attempts, window_started_at
       )
       SELECT attempts,
         GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
           window_started_at + make_interval(secs => $2) - now()
         ))))::integer AS retry_after_seconds
       FROM updated`,
      [key, windowSeconds],
    );
    const row = result.rows[0];
    const attempts = row?.attempts ?? limit + 1;
    return {
      allowed: attempts <= limit,
      retryAfterSeconds: row?.retry_after_seconds ?? windowSeconds,
    };
  }

  async saveCode(value: McpAuthorizationCode): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_oauth_codes (
         code_hash, client_id, redirect_uri, code_challenge,
         resource, scopes, subject, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        value.codeHash, value.clientId, value.redirectUri, value.codeChallenge,
        value.resource, value.scopes, value.subject, value.expiresAt,
      ],
    );
  }

  async consumeCode(
    codeHash: string,
    now: Date,
  ): Promise<McpAuthorizationCode | null> {
    const result = await this.pool.query<CodeRow>(
      `UPDATE mcp_oauth_codes SET consumed_at = $2
       WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > $2
       RETURNING code_hash, client_id, redirect_uri, code_challenge,
         resource, scopes, subject, expires_at`,
      [codeHash, now],
    );
    return result.rows[0] ? code(result.rows[0]) : null;
  }

  async saveToken(value: McpOAuthToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_oauth_tokens (
         token_hash, kind, client_id, resource, scopes, subject, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        value.tokenHash, value.kind, value.clientId, value.resource,
        value.scopes, value.subject, value.expiresAt,
      ],
    );
  }

  async findToken(
    tokenHash: string,
    kind: McpTokenKind,
    now: Date,
  ): Promise<McpOAuthToken | null> {
    const result = await this.pool.query<TokenRow>(
      `SELECT token_hash, kind, client_id, resource, scopes, subject, expires_at
       FROM mcp_oauth_tokens
       WHERE token_hash = $1 AND kind = $2 AND revoked_at IS NULL AND expires_at > $3`,
      [tokenHash, kind, now],
    );
    return result.rows[0] ? token(result.rows[0]) : null;
  }

  async consumeToken(
    tokenHash: string,
    kind: McpTokenKind,
    now: Date,
  ): Promise<McpOAuthToken | null> {
    const result = await this.pool.query<TokenRow>(
      `UPDATE mcp_oauth_tokens SET revoked_at = $3
       WHERE token_hash = $1 AND kind = $2 AND revoked_at IS NULL AND expires_at > $3
       RETURNING token_hash, kind, client_id, resource, scopes, subject, expires_at`,
      [tokenHash, kind, now],
    );
    return result.rows[0] ? token(result.rows[0]) : null;
  }
}
