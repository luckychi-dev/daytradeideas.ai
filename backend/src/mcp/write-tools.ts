import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeScope } from "./auth-context.js";
import type { KnowledgeToolService } from "./knowledge-tool-service.js";
import { mutationSchema, summarySchema } from "./schemas.js";
import { runTool } from "./tool-output.js";

const updateSchema = mutationSchema.extend({
  document_id: z.string().uuid(),
});

export function registerWriteTools(
  server: McpServer,
  tools: KnowledgeToolService,
): void {
  server.registerTool("create_knowledge_document", {
    title: "Create knowledge document",
    description:
      "Use this when Jason asks to add new approved teaching to the knowledge library. Supply the full document content.",
    inputSchema: mutationSchema,
    outputSchema: { document: summarySchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (input, extra) => {
    const context = writeScope(extra);
    return runTool(async () => ({
      document: await tools.create(context.actor, input),
    }), ({ document }) => `Created ${document.title} version ${document.version}.`);
  });

  server.registerTool("update_knowledge_document", {
    title: "Update knowledge document",
    description:
      "Use this after fetching the document and confirming Jason wants to replace its content or metadata.",
    inputSchema: updateSchema,
    outputSchema: { document: summarySchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ document_id, ...input }, extra) => {
    const context = writeScope(extra);
    return runTool(async () => ({
      document: await tools.update(context.actor, document_id, input),
    }), ({ document }) => `Updated ${document.title} version ${document.version}.`);
  });

  server.registerTool("delete_knowledge_document", {
    title: "Delete knowledge document",
    description:
      "Use only after Jason explicitly confirms deletion. Read the document first and pass its exact title as confirmation.",
    inputSchema: {
      document_id: z.string().uuid(),
      title_confirmation: z.string().min(1).max(240)
        .describe("The exact current title of the document being deleted."),
    },
    outputSchema: { deleted: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ document_id, title_confirmation }, extra) => {
    const context = writeScope(extra);
    return runTool(async () => ({
      ...await tools.delete(context.actor, document_id, title_confirmation),
    }), () => "Knowledge document and its retrieval chunks were deleted.");
  });
}
