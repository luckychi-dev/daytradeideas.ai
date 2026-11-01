import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KnowledgeToolService } from "./knowledge-tool-service.js";
import { registerReadTools } from "./read-tools.js";
import { registerWriteTools } from "./write-tools.js";

export function createKnowledgeMcpServer(tools: KnowledgeToolService): McpServer {
  const server = new McpServer(
    { name: "daytradeideas-knowledge", version: "1.0.0" },
    {
      instructions:
        "Use search before fetch. Read a document before update or delete. " +
        "Never delete unless the user explicitly confirms and title_confirmation exactly matches.",
    },
  );
  registerReadTools(server, tools);
  registerWriteTools(server, tools);
  return server;
}
