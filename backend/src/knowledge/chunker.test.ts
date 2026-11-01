import { describe, expect, it } from "vitest";
import { chunkParagraphs } from "./chunker.js";
import type { PlannedSource } from "./types.js";

const source: PlannedSource = {
  key: "test",
  relativePath: "test.docx",
  title: "Test source",
  version: "1.0",
  moduleCode: "TEST",
  authorOrSpeaker: "Test",
  authorityLayer: "A",
  approvalStatus: "validation_required",
  retrievalPermission: "admin_only",
  contentType: "test",
  topicTags: ["test"],
  kind: "docx",
};

describe("chunkParagraphs", () => {
  it("retains source paragraph ranges", () => {
    const chunks = chunkParagraphs(["First paragraph.", "Second paragraph."], source);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.locator).toContain("paragraphs 1-2");
  });

  it("splits long content without producing empty chunks", () => {
    const paragraphs = Array.from({ length: 30 }, (_, index) =>
      `Paragraph ${index + 1}. ${"Evidence and caveat. ".repeat(12)}`,
    );
    const chunks = chunkParagraphs(paragraphs, source);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 1800)).toBe(true);
  });
});

