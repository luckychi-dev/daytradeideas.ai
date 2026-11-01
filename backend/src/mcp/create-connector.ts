import type { Pool } from "pg";
import type { AppConfig } from "../config.js";
import { PostgresMcpOAuthRepository } from "../adapters/postgres/mcp-oauth-repository.js";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { KnowledgeAdminPort } from "../domain/admin-knowledge-ports.js";
import type { KnowledgeRetriever } from "../domain/ports.js";
import { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import { McpOAuthService } from "../domain/mcp-oauth-service.js";
import { KnowledgeToolService } from "./knowledge-tool-service.js";
import type { McpConnectorDependencies } from "./runtime.js";

interface ConnectorInput {
  pool: Pool;
  config: AppConfig;
  admin: AdminRepository;
  knowledgeAdmin: KnowledgeAdminPort;
  knowledgeRetriever: KnowledgeRetriever;
}

export function createMcpConnector(
  input: ConnectorInput,
): McpConnectorDependencies | undefined {
  const { MCP_ADMIN_EMAIL: email, MCP_ADMIN_PASSWORD: password } = input.config;
  if (!email || !password) return undefined;
  const repository = new PostgresMcpOAuthRepository(input.pool);
  return {
    issuer: input.config.MCP_AUTH_ISSUER.replace(/\/$/, ""),
    resource: input.config.MCP_SERVER_URL,
    clients: new McpOAuthClientService(repository, {
      adminEmail: email,
      adminPassword: password,
      allowLocalRedirects: input.config.NODE_ENV !== "production",
    }),
    oauth: new McpOAuthService(repository, {
      resource: input.config.MCP_SERVER_URL,
    }),
    tools: new KnowledgeToolService(
      input.knowledgeAdmin,
      input.knowledgeRetriever,
      input.admin,
      input.config.MCP_WEB_ADMIN_URL,
    ),
  };
}
