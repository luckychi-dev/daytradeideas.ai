import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KnowledgeToolService } from "./knowledge-tool-service.js";
import { readScope } from "./auth-context.js";
import {
  documentSchema,
  profileSchema,
  searchResultSchema,
  summarySchema,
} from "./schemas.js";
import { runTool } from "./tool-output.js";

export function registerReadTools(
  server: McpServer,
  tools: KnowledgeToolService,
): void {
  server.registerTool("get_connector_profile", {
    title: "Get connected admin profile",
    description: "Use this to identify the currently connected Day Trade Ideas admin account.",
    outputSchema: { profile: profileSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { "openai/profile": true },
  }, async (extra) => {
    const context = readScope(extra);
    return runTool(async () => ({
      profile: { name: "Jason Sen", email: context.email, role: "admin" as const },
    }), ({ profile }) => `Connected as ${profile.email}.`);
  });

  server.registerTool("list_knowledge_documents", {
    title: "List knowledge documents",
    description:
      "Use this when the user wants to review which documents are in Jason's knowledge library.",
    outputSchema: { documents: z.array(summarySchema) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (extra) => {
    const context = readScope(extra);
    return runTool(async () => ({
      documents: await tools.list(context.actor),
    }), ({ documents }) => `Found ${documents.length} knowledge documents.`);
  });

  server.registerTool("search", {
    title: "Search Jason knowledge",
    description:
      "Use this to find approved Day Trade Ideas teaching before answering a question or editing knowledge.",
    inputSchema: {
      query: z.string().trim().min(2).max(500),
      limit: z.number().int().min(1).max(20).default(8),
    },
    outputSchema: { results: z.array(searchResultSchema) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ query, limit }, extra) => {
    const context = readScope(extra);
    return runTool(async () => ({
      results: await tools.search(context.actor, query, limit),
    }), ({ results }) => `Found ${results.length} relevant knowledge sources.`);
  });

  server.registerTool("fetch", {
    title: "Read a knowledge document",
    description:
      "Use this with a document ID from search or list to read its full content before answering or changing it.",
    inputSchema: { id: z.string().uuid() },
    outputSchema: { document: documentSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ id }, extra) => {
    const context = readScope(extra);
    return runTool(async () => ({
      document: await tools.fetch(context.actor, id),
    }), ({ document }) => `Read ${document.title} version ${document.version}.`);
  });
}
