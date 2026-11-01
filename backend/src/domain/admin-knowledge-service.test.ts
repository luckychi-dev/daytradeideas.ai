import { describe, expect, it, vi } from "vitest";
import type {
  KnowledgeAdminRepository,
  KnowledgeFileReader,
} from "./admin-knowledge-ports.js";
import {
  KnowledgeAdminService,
  KnowledgeDocumentNotFoundError,
  KnowledgeInputError,
} from "./admin-knowledge-service.js";
import type {
  KnowledgeDocument,
  KnowledgeDocumentWrite,
} from "./admin-knowledge-types.js";

const document: KnowledgeDocument = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Risk notes",
  version: "1.0",
  moduleCode: "CUSTOM",
  authorOrSpeaker: "Jason Sen",
  authorityLayer: "B",
  contentType: "teaching",
  approvalStatus: "approved",
  chunkCount: 1,
  contentLength: 40,
  sourceFile: "risk-notes.txt",
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  content: "Never widen a stop after entry.",
  topicTags: ["risk"],
};

function setup() {
  const writes: KnowledgeDocumentWrite[] = [];
  const repository: KnowledgeAdminRepository = {
    listDocuments: async () => [document],
    getDocument: async () => document,
    createDocument: vi.fn(async (input: KnowledgeDocumentWrite) => {
      writes.push(input);
      return document;
    }),
    updateDocument: vi.fn(async (_id: string, input: KnowledgeDocumentWrite) => {
      writes.push(input);
      return document;
    }),
    deleteDocument: vi.fn(async () => true),
  };
  const files: KnowledgeFileReader = {
    extract: vi.fn(async () => ({
      content: "Extracted lesson.",
      fileName: "lesson.docx",
    })),
  };
  return {
    service: new KnowledgeAdminService(repository, files),
    repository,
    files,
    writes,
  };
}

describe("KnowledgeAdminService", () => {
  it("turns uploaded text into approved retrieval chunks", async () => {
    const { service, writes } = setup();
    await service.create({
      title: "Risk notes",
      version: "1.0",
      moduleCode: "CUSTOM",
      authorOrSpeaker: "Jason Sen",
      authorityLayer: "B",
      contentType: "teaching",
      topicTags: ["risk"],
      content: "Never widen a stop after entry.",
    });
    expect(writes[0]?.chunks[0]).toMatchObject({
      approvalStatus: "approved",
      retrievalPermission: "production_teaching",
    });
  });

  it("uses the file reader when a document is supplied", async () => {
    const { service, files, writes } = setup();
    await service.create({
      title: "Lesson",
      version: "1.0",
      moduleCode: "CUSTOM",
      authorOrSpeaker: "Jason Sen",
      authorityLayer: "B",
      contentType: "teaching",
      topicTags: [],
      file: {
        fileName: "lesson.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        base64: "AA==",
      },
    });
    expect(files.extract).toHaveBeenCalledOnce();
    expect(writes[0]?.content).toBe("Extracted lesson.");
    expect(writes[0]?.sourceFile).toBe("lesson.docx");
  });

  it("rejects empty knowledge", async () => {
    const { service } = setup();
    await expect(service.create({
      title: "Empty",
      version: "1.0",
      moduleCode: "CUSTOM",
      authorOrSpeaker: "Jason Sen",
      authorityLayer: "B",
      contentType: "teaching",
      topicTags: [],
      content: " ",
    })).rejects.toBeInstanceOf(KnowledgeInputError);
  });

  it("reports missing documents", async () => {
    const { service, repository } = setup();
    repository.getDocument = async () => null;
    await expect(service.get(document.id)).rejects.toBeInstanceOf(
      KnowledgeDocumentNotFoundError,
    );
  });
});
