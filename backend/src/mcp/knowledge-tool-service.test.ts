import { describe, expect, it, vi } from "vitest";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { KnowledgeAdminPort } from "../domain/admin-knowledge-ports.js";
import type { KnowledgeDocument } from "../domain/admin-knowledge-types.js";
import type { KnowledgeRetriever } from "../domain/ports.js";
import { KnowledgeToolService } from "./knowledge-tool-service.js";

const now = new Date("2026-11-01T10:00:00.000Z");
const document: KnowledgeDocument = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Risk fundamentals",
  version: "1.0",
  moduleCode: "KB04",
  authorOrSpeaker: "Jason Sen",
  authorityLayer: "B",
  contentType: "teaching",
  approvalStatus: "approved",
  chunkCount: 2,
  contentLength: 24,
  sourceFile: "risk.docx",
  updatedAt: now,
  content: "Risk comes before reward.",
  topicTags: ["risk"],
};

function setup() {
  const documents: KnowledgeAdminPort = {
    list: vi.fn(async () => [document]),
    get: vi.fn(async () => document),
    create: vi.fn(async () => document),
    update: vi.fn(async () => document),
    delete: vi.fn(async () => {}),
  };
  const retrieval: KnowledgeRetriever = {
    search: vi.fn(async () => [{
      id: "chunk-1",
      sourceId: document.id,
      sourceTitle: document.title,
      sourceVersion: document.version,
      locator: "chunk:1",
      authorityLayer: "B" as const,
      content: document.content,
    }]),
  };
  const admin = {
    audit: vi.fn(async () => {}),
  } as unknown as AdminRepository;
  return {
    documents,
    admin,
    service: new KnowledgeToolService(
      documents,
      retrieval,
      admin,
      "https://admin.example/",
    ),
  };
}

describe("knowledge MCP tools", () => {
  it("returns searchable source documents with stable IDs", async () => {
    const { service } = setup();
    const results = await service.search("mcp:admin", "risk", 8);
    expect(results).toEqual([{
      id: document.id,
      title: "Risk fundamentals (1.0)",
      text: document.content,
      url: `https://admin.example/#knowledge/${document.id}`,
    }]);
  });

  it("requires the exact title before deleting", async () => {
    const { service, documents } = setup();
    await expect(service.delete("mcp:admin", document.id, "Wrong title"))
      .rejects.toThrow("confirmation title");
    expect(documents.delete).not.toHaveBeenCalled();
  });

  it("deletes an explicitly confirmed document and audits it", async () => {
    const { service, documents, admin } = setup();
    await expect(service.delete("mcp:admin", document.id, document.title))
      .resolves.toEqual({ deleted: true });
    expect(documents.delete).toHaveBeenCalledWith(document.id);
    expect(admin.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "mcp.knowledge.document_deleted",
    }));
  });
});
