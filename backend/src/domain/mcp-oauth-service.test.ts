import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { McpOAuthRepository } from "./mcp-oauth-ports.js";
import { McpOAuthClientService } from "./mcp-oauth-client-service.js";
import { McpOAuthError, McpOAuthService } from "./mcp-oauth-service.js";
import type {
  McpAuthorizationCode,
  McpOAuthClient,
  McpOAuthToken,
  McpRateLimitDecision,
  McpTokenKind,
} from "./mcp-oauth-types.js";

class MemoryRepository implements McpOAuthRepository {
  clients = new Map<string, McpOAuthClient>();
  codes = new Map<string, McpAuthorizationCode>();
  tokens = new Map<string, McpOAuthToken>();

  async createClient(client: McpOAuthClient): Promise<void> {
    this.clients.set(client.clientId, client);
  }

  async findClient(id: string): Promise<McpOAuthClient | null> {
    return this.clients.get(id) ?? null;
  }

  async consumeRateLimit(): Promise<McpRateLimitDecision> {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async saveCode(code: McpAuthorizationCode): Promise<void> {
    this.codes.set(code.codeHash, code);
  }

  async consumeCode(hash: string): Promise<McpAuthorizationCode | null> {
    const value = this.codes.get(hash) ?? null;
    this.codes.delete(hash);
    return value;
  }

  async saveToken(token: McpOAuthToken): Promise<void> {
    this.tokens.set(token.tokenHash, token);
  }

  async findToken(
    hash: string,
    kind: McpTokenKind,
  ): Promise<McpOAuthToken | null> {
    const value = this.tokens.get(hash);
    return value?.kind === kind ? value : null;
  }

  async consumeToken(
    hash: string,
    kind: McpTokenKind,
  ): Promise<McpOAuthToken | null> {
    const value = await this.findToken(hash, kind);
    if (value) this.tokens.delete(hash);
    return value;
  }
}

const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");

function setup() {
  const repository = new MemoryRepository();
  const clients = new McpOAuthClientService(repository, {
    adminEmail: "admin@example.com",
    adminPassword: "a-secure-admin-password-123456",
    allowLocalRedirects: true,
  });
  const oauth = new McpOAuthService(repository, {
    resource: "https://api.example.com/mcp",
  });
  return { repository, clients, oauth };
}

async function authorization() {
  const state = setup();
  const client = await state.clients.registerClient("ChatGPT", [
    "https://chatgpt.com/connector/oauth/callback_1",
  ]);
  const request = await state.oauth.validateAuthorization({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUris[0]!,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: "https://api.example.com/mcp",
    scope: "knowledge:read knowledge:write",
    state: "state-1",
  });
  return { ...state, client, request };
}

describe("MCP OAuth service", () => {
  it("issues, exchanges, verifies and refreshes scoped tokens", async () => {
    const { oauth, client, request } = await authorization();
    const code = await oauth.issueCode(request, "admin@example.com");
    const tokens = await oauth.exchangeCode({
      code,
      clientId: client.clientId,
      redirectUri: client.redirectUris[0]!,
      codeVerifier: verifier,
      resource: "https://api.example.com/mcp",
    });
    const access = await oauth.verifyAccessToken(tokens.access_token);
    expect(access.scopes).toEqual(["knowledge:read", "knowledge:write"]);
    expect(access.subject).toBe("admin@example.com");

    const refreshed = await oauth.refresh({
      refreshToken: tokens.refresh_token,
      clientId: client.clientId,
      resource: "https://api.example.com/mcp",
    });
    expect(refreshed.access_token).not.toBe(tokens.access_token);
    await expect(oauth.refresh({
      refreshToken: tokens.refresh_token,
      clientId: client.clientId,
      resource: "https://api.example.com/mcp",
    })).rejects.toBeInstanceOf(McpOAuthError);
  });

  it("rejects an incorrect PKCE verifier", async () => {
    const { oauth, client, request } = await authorization();
    const code = await oauth.issueCode(request, "admin@example.com");
    await expect(oauth.exchangeCode({
      code,
      clientId: client.clientId,
      redirectUri: client.redirectUris[0]!,
      codeVerifier: "b".repeat(43),
      resource: "https://api.example.com/mcp",
    })).rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("rejects redirect URIs outside ChatGPT and localhost", async () => {
    const { clients } = setup();
    await expect(clients.registerClient("Bad client", [
      "https://attacker.example/callback",
    ])).rejects.toMatchObject({ code: "invalid_redirect_uri" });
  });
});
