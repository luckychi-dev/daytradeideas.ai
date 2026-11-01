import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import type { McpOAuthService } from "../domain/mcp-oauth-service.js";
import { registerMcpOAuthRoutes } from "./mcp-oauth-route.js";

describe("MCP OAuth authorization page", () => {
  it("allows the validated ChatGPT redirect after form submission", async () => {
    const app = Fastify({ trustProxy: true });
    const client = {
      clientId: "mcp_client",
      clientName: "ChatGPT",
      redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
    };
    const clients = {
      authenticate: vi.fn(() => false),
      checkRateLimit: vi.fn(async () => {}),
    } as unknown as McpOAuthClientService;
    const oauth = {
      validateAuthorization: vi.fn(async () => ({
        client,
        redirectUri: client.redirectUris[0]!,
        codeChallenge: "a".repeat(43),
        resource: "https://api.example.com/mcp",
        scopes: ["knowledge:read", "knowledge:write"],
        state: "state-1",
      })),
    } as unknown as McpOAuthService;
    const admin = { audit: vi.fn(async () => {}) } as unknown as AdminRepository;
    await registerMcpOAuthRoutes(app, {
      resource: "https://api.example.com/mcp",
      clients,
      oauth,
      admin,
    });
    const response = await app.inject({
      method: "GET",
      url: "/oauth/authorize?response_type=code",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-security-policy"]).toContain(
      "form-action 'self' https://chatgpt.com",
    );
    await app.close();
  });
});
