import type {
  McpAuthorizationCode,
  McpOAuthClient,
  McpOAuthToken,
  McpRateLimitDecision,
  McpTokenKind,
} from "./mcp-oauth-types.js";

export interface McpOAuthRepository {
  createClient(client: McpOAuthClient): Promise<void>;
  findClient(clientId: string): Promise<McpOAuthClient | null>;
  consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<McpRateLimitDecision>;
  saveCode(code: McpAuthorizationCode): Promise<void>;
  consumeCode(codeHash: string, now: Date): Promise<McpAuthorizationCode | null>;
  saveToken(token: McpOAuthToken): Promise<void>;
  findToken(
    tokenHash: string,
    kind: McpTokenKind,
    now: Date,
  ): Promise<McpOAuthToken | null>;
  consumeToken(
    tokenHash: string,
    kind: McpTokenKind,
    now: Date,
  ): Promise<McpOAuthToken | null>;
}
