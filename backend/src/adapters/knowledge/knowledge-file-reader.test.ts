import { describe, expect, it } from "vitest";
import { KnowledgeInputError } from "../../domain/admin-knowledge-service.js";
import { LocalKnowledgeFileReader } from "./knowledge-file-reader.js";

const reader = new LocalKnowledgeFileReader();

describe("LocalKnowledgeFileReader", () => {
  it("extracts plain text and normalizes paragraphs", async () => {
    const base64 = Buffer.from("First lesson.\n\nSecond lesson.").toString("base64");
    await expect(reader.extract({
      fileName: "lesson.md",
      mimeType: "text/markdown",
      base64,
    })).resolves.toEqual({
      content: "First lesson.\n\nSecond lesson.",
      fileName: "lesson.md",
    });
  });

  it("rejects unsupported file types", async () => {
    await expect(reader.extract({
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      base64: Buffer.from("not a pdf").toString("base64"),
    })).rejects.toBeInstanceOf(KnowledgeInputError);
  });
});
