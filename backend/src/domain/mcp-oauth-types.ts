export const MCP_READ_SCOPE = "knowledge:read";
export const MCP_WRITE_SCOPE = "knowledge:write";
export const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

export interface McpOAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

export interface McpAuthorizationRequest {
  client: McpOAuthClient;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scopes: string[];
  state?: string | undefined;
}

export interface McpAuthorizationCode {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scopes: string[];
  subject: string;
  expiresAt: Date;
}

export type McpTokenKind = "access" | "refresh";

export interface McpOAuthToken {
  tokenHash: string;
  kind: McpTokenKind;
  clientId: string;
  resource: string;
  scopes: string[];
  subject: string;
  expiresAt: Date;
}

export interface McpTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface McpAccessContext {
  subject: string;
  clientId: string;
  scopes: string[];
  resource: string;
  expiresAt: number;
}

export interface McpRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}
