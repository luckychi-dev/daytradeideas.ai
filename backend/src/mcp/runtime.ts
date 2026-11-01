import type { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import type { McpOAuthService } from "../domain/mcp-oauth-service.js";
import type { KnowledgeToolService } from "./knowledge-tool-service.js";

export interface McpConnectorDependencies {
  issuer: string;
  resource: string;
  iconUrl: string;
  clients: McpOAuthClientService;
  oauth: McpOAuthService;
  tools: KnowledgeToolService;
}
