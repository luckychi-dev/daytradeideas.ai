import { digest, opaqueToken, PKCE_VALUE, verifyPkce } from "./mcp-oauth-crypto.js";
import type { McpOAuthRepository } from "./mcp-oauth-ports.js";
import {
  MCP_READ_SCOPE,
  MCP_SCOPES,
  MCP_WRITE_SCOPE,
  type McpAccessContext,
  type McpAuthorizationRequest,
  type McpOAuthToken,
  type McpTokenResponse,
} from "./mcp-oauth-types.js";

export class McpOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

interface McpOAuthOptions {
  resource: string;
  now?: (() => Date) | undefined;
}

interface CodeExchange {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
}

interface RefreshExchange {
  refreshToken: string;
  clientId: string;
  resource: string;
  scopes?: string[] | undefined;
}

const CODE_TTL_MS = 5 * 60_000;
const ACCESS_TTL_MS = 30 * 24 * 60 * 60_000;
const REFRESH_TTL_MS = 180 * 24 * 60 * 60_000;

export class McpOAuthService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: McpOAuthRepository,
    private readonly options: McpOAuthOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async validateAuthorization(input: Record<string, string>): Promise<McpAuthorizationRequest> {
    if (input.response_type !== "code") {
      throw new McpOAuthError("unsupported_response_type", "Authorization code required.");
    }
    const client = await this.repository.findClient(input.client_id ?? "");
    if (!client) throw new McpOAuthError("invalid_client", "Unknown OAuth client.");
    const redirectUri = input.redirect_uri ?? "";
    if (!client.redirectUris.includes(redirectUri)) {
      throw new McpOAuthError("invalid_request", "Redirect URI is not registered.");
    }
    if (input.code_challenge_method !== "S256" || !PKCE_VALUE.test(input.code_challenge ?? "")) {
      throw new McpOAuthError("invalid_request", "PKCE S256 is required.");
    }
    if ((input.resource ?? "") !== this.options.resource) {
      throw new McpOAuthError("invalid_target", "OAuth resource does not match this server.");
    }
    return {
      client,
      redirectUri,
      codeChallenge: input.code_challenge ?? "",
      resource: this.options.resource,
      scopes: this.parseScopes(input.scope),
      state: input.state || undefined,
    };
  }

  async issueCode(request: McpAuthorizationRequest, subject: string): Promise<string> {
    const code = opaqueToken();
    await this.repository.saveCode({
      codeHash: digest(code),
      clientId: request.client.clientId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      resource: request.resource,
      scopes: request.scopes,
      subject,
      expiresAt: new Date(this.now().getTime() + CODE_TTL_MS),
    });
    return code;
  }

  async exchangeCode(input: CodeExchange): Promise<McpTokenResponse> {
    const record = await this.repository.consumeCode(digest(input.code), this.now());
    if (!record) throw new McpOAuthError("invalid_grant", "Authorization code is invalid.");
    if (record.clientId !== input.clientId || record.redirectUri !== input.redirectUri) {
      throw new McpOAuthError("invalid_grant", "Authorization code does not match the client.");
    }
    if (record.resource !== input.resource || record.resource !== this.options.resource) {
      throw new McpOAuthError("invalid_target", "Resource does not match.");
    }
    if (!verifyPkce(input.codeVerifier, record.codeChallenge)) {
      throw new McpOAuthError("invalid_grant", "PKCE verification failed.");
    }
    return this.issueTokenPair(
      record.clientId,
      record.subject,
      record.scopes,
      record.resource,
    );
  }

  async refresh(input: RefreshExchange): Promise<McpTokenResponse> {
    const record = await this.repository.consumeToken(
      digest(input.refreshToken),
      "refresh",
      this.now(),
    );
    if (!record) throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
    if (record.clientId !== input.clientId || record.resource !== input.resource) {
      throw new McpOAuthError("invalid_grant", "Refresh token does not match the request.");
    }
    const scopes = input.scopes?.length ? input.scopes : record.scopes;
    if (!scopes.every((scope) => record.scopes.includes(scope))) {
      throw new McpOAuthError("invalid_scope", "Refresh cannot expand token scopes.");
    }
    return this.issueTokenPair(record.clientId, record.subject, scopes, record.resource);
  }

  async verifyAccessToken(token: string): Promise<McpAccessContext> {
    const record = await this.repository.findToken(digest(token), "access", this.now());
    if (!record || record.resource !== this.options.resource) {
      throw new McpOAuthError("invalid_token", "Access token is invalid.", 401);
    }
    return {
      subject: record.subject,
      clientId: record.clientId,
      scopes: record.scopes,
      resource: record.resource,
      expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
    };
  }

  private parseScopes(raw: string | undefined): string[] {
    const requested = raw?.split(/\s+/).filter(Boolean) ?? [...MCP_SCOPES];
    if (!requested.every((scope) => MCP_SCOPES.includes(scope as never))) {
      throw new McpOAuthError("invalid_scope", "Requested scope is not supported.");
    }
    return [...new Set(requested)];
  }

  private async issueTokenPair(
    clientId: string,
    subject: string,
    scopes: string[],
    resource: string,
  ): Promise<McpTokenResponse> {
    const accessToken = opaqueToken();
    const refreshToken = opaqueToken();
    const now = this.now();
    const base = { clientId, subject, scopes, resource };
    const access: McpOAuthToken = {
      ...base,
      tokenHash: digest(accessToken),
      kind: "access",
      expiresAt: new Date(now.getTime() + ACCESS_TTL_MS),
    };
    const refresh: McpOAuthToken = {
      ...base,
      tokenHash: digest(refreshToken),
      kind: "refresh",
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
    };
    await this.repository.saveToken(access);
    await this.repository.saveToken(refresh);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: [MCP_READ_SCOPE, MCP_WRITE_SCOPE].filter((scope) => scopes.includes(scope)).join(" "),
    };
  }
}
