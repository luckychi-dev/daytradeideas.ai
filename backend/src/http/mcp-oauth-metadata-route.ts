import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import { digest } from "../domain/mcp-oauth-crypto.js";
import { McpOAuthError } from "../domain/mcp-oauth-service.js";
import {
  MCP_READ_SCOPE,
  MCP_SCOPES,
  MCP_WRITE_SCOPE,
} from "../domain/mcp-oauth-types.js";

interface MetadataOptions {
  issuer: string;
  resource: string;
  clients: McpOAuthClientService;
  admin: AdminRepository;
}

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  client_name: z.string().max(200).optional(),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
  scope: z.string().max(500).optional(),
});

function oauthError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof McpOAuthError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      error_description: error.message,
    });
  }
  throw error;
}

export async function registerMcpOAuthMetadataRoutes(
  app: FastifyInstance,
  options: MetadataOptions,
): Promise<void> {
  const protectedResource = async () => ({
    resource: options.resource,
    authorization_servers: [options.issuer],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
  });

  app.get("/.well-known/oauth-protected-resource", protectedResource);
  app.get("/.well-known/oauth-protected-resource/mcp", protectedResource);

  app.get("/.well-known/oauth-authorization-server", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=300");
    return {
      issuer: options.issuer,
      authorization_response_iss_parameter_supported: false,
      authorization_endpoint: `${options.issuer}/oauth/authorize`,
      token_endpoint: `${options.issuer}/oauth/token`,
      registration_endpoint: `${options.issuer}/oauth/register`,
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      scopes_supported: [...MCP_SCOPES],
      resource: options.resource,
    };
  });

  app.post("/oauth/register", async (request, reply) => {
    const ipKey = `mcp-register:${digest(request.ip)}`;
    await options.clients.checkRateLimit(ipKey, 10, 900);
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_client_metadata",
        error_description: "Valid redirect_uris and token_endpoint_auth_method=none are required.",
      });
    }
    try {
      const client = await options.clients.registerClient(
        parsed.data.client_name ?? "ChatGPT connector",
        parsed.data.redirect_uris,
      );
      await options.admin.audit({
        actor: "mcp-oauth",
        action: "mcp.oauth_client_registered",
        targetType: "oauth_client",
        targetId: client.clientId,
        details: { clientName: client.clientName },
      });
      return reply.code(201).send({
        client_id: client.clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: `${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}`,
      });
    } catch (error) {
      return oauthError(reply, error);
    }
  });
}
