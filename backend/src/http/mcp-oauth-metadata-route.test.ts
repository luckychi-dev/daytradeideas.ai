import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import { registerMcpOAuthMetadataRoutes } from "./mcp-oauth-metadata-route.js";

describe("MCP OAuth metadata routes", () => {
  it("accepts ChatGPT registration with refresh token support", async () => {
    const app = Fastify();
    const clients = {
      checkRateLimit: vi.fn(async () => {}),
      registerClient: vi.fn(async (_name: string, redirectUris: string[]) => ({
        clientId: "mcp_client_1",
        clientName: "ChatGPT",
        redirectUris,
      })),
    } as unknown as McpOAuthClientService;
    const admin = { audit: vi.fn(async () => {}) } as unknown as AdminRepository;
    await registerMcpOAuthMetadataRoutes(app, {
      issuer: "https://api.example.com",
      resource: "https://api.example.com/mcp",
      clients,
      admin,
    });
    const response = await app.inject({
      method: "POST",
      url: "/oauth/register",
      payload: {
        client_name: "ChatGPT",
        redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      client_id: "mcp_client_1",
      grant_types: ["authorization_code", "refresh_token"],
    });
    await app.close();
  });
});
