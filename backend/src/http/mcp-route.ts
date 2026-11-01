import type { FastifyInstance, FastifyReply } from "fastify";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpOAuthService } from "../domain/mcp-oauth-service.js";
import { MCP_SCOPES } from "../domain/mcp-oauth-types.js";
import { createKnowledgeMcpServer } from "../mcp/server-factory.js";
import type { KnowledgeToolService } from "../mcp/knowledge-tool-service.js";

interface McpRouteOptions {
  issuer: string;
  resource: string;
  iconUrl: string;
  oauth: McpOAuthService;
  tools: KnowledgeToolService;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && !extra ? token : null;
}

function unauthorized(reply: FastifyReply, resourceMetadata: string): FastifyReply {
  return reply
    .code(401)
    .header(
      "www-authenticate",
      `Bearer resource_metadata="${resourceMetadata}", scope="${MCP_SCOPES.join(" ")}"`,
    )
    .send({ error: "unauthorized", message: "Connect this server with OAuth." });
}

export async function registerMcpRoute(
  app: FastifyInstance,
  options: McpRouteOptions,
): Promise<void> {
  const metadataUrl = `${options.issuer}/.well-known/oauth-protected-resource`;

  app.post("/mcp", { bodyLimit: 3 * 1024 * 1024 }, async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return unauthorized(reply, metadataUrl);
    let context;
    try {
      context = await options.oauth.verifyAccessToken(token);
    } catch {
      return unauthorized(reply, metadataUrl);
    }
    if (context.resource !== options.resource) return unauthorized(reply, metadataUrl);

    const auth: AuthInfo = {
      token,
      clientId: context.clientId,
      scopes: context.scopes,
      expiresAt: context.expiresAt,
      resource: new URL(context.resource),
      extra: { email: context.subject },
    };
    const rawRequest = request.raw as typeof request.raw & { auth?: AuthInfo };
    rawRequest.auth = auth;
    const server = createKnowledgeMcpServer(options.tools, options.iconUrl);
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      void transport.close();
      void server.close();
    };
    reply.raw.once("close", close);
    reply.hijack();
    try {
      await transport.handleRequest(rawRequest, reply.raw, request.body);
    } catch (error) {
      close();
      request.log.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "MCP request failed.",
      );
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
        reply.raw.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        }));
      }
    }
  });

  app.get("/mcp", async (_request, reply) =>
    reply.code(405).header("allow", "POST").send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));

  app.delete("/mcp", async (_request, reply) =>
    reply.code(405).header("allow", "POST").send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
}
