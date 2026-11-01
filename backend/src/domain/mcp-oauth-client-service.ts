import { constantTimeEqual, opaqueToken } from "./mcp-oauth-crypto.js";
import type { McpOAuthRepository } from "./mcp-oauth-ports.js";
import { McpOAuthError } from "./mcp-oauth-service.js";
import type { McpOAuthClient } from "./mcp-oauth-types.js";

interface ClientOptions {
  adminEmails: string[];
  adminPassword: string;
  allowLocalRedirects?: boolean | undefined;
}

export class McpOAuthClientService {
  constructor(
    private readonly repository: McpOAuthRepository,
    private readonly options: ClientOptions,
  ) {}

  async registerClient(name: string, redirectUris: string[]): Promise<McpOAuthClient> {
    const unique = [...new Set(redirectUris)];
    if (unique.length === 0 || unique.length > 10) {
      throw new McpOAuthError("invalid_redirect_uri", "A redirect URI is required.");
    }
    if (!unique.every((uri) => this.allowedRedirect(uri))) {
      throw new McpOAuthError("invalid_redirect_uri", "Redirect URI is not allowed.");
    }
    const client = {
      clientId: `mcp_${opaqueToken()}`,
      clientName: name.trim().slice(0, 200) || "ChatGPT connector",
      redirectUris: unique,
    };
    await this.repository.createClient(client);
    return client;
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const result = await this.repository.consumeRateLimit(key, limit, windowSeconds);
    if (!result.allowed) {
      throw new McpOAuthError(
        "slow_down",
        `Try again in ${result.retryAfterSeconds} seconds.`,
        429,
      );
    }
  }

  authenticate(email: string, password: string): boolean {
    const normalized = email.trim().toLowerCase();
    return this.options.adminEmails.some((allowed) =>
      normalized === allowed.toLowerCase()
    ) &&
      constantTimeEqual(password, this.options.adminPassword);
  }

  private allowedRedirect(value: string): boolean {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "chatgpt.com") {
      return url.pathname === "/connector_platform_oauth_redirect" ||
        /^\/connector\/oauth\/[A-Za-z0-9._~-]+$/.test(url.pathname);
    }
    return Boolean(
      this.options.allowLocalRedirects &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1"),
    );
  }
}
