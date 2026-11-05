import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readDocxParagraphs } from "./docx-reader.js";
import { SOURCE_PLAN } from "./source-plan.js";

async function sourceText(key: string): Promise<string> {
  const source = SOURCE_PLAN.find((item) => item.key === key);
  if (!source) throw new Error(`Missing source ${key}`);
  const path = fileURLToPath(new URL(`../../../${source.relativePath}`, import.meta.url));
  if (source.kind === "text") return readFile(path, "utf8");
  return (await readDocxParagraphs(path)).paragraphs.join("\n");
}

describe("production teaching sources", () => {
  it("marks the core teaching modules production eligible", () => {
    for (const key of ["kb01", "kb02", "kb03", "kb04", "kb05", "kb06"]) {
      expect(SOURCE_PLAN.find((source) => source.key === key)).toMatchObject({
        approvalStatus: "approved",
        retrievalPermission: "production_teaching",
      });
    }
    expect(SOURCE_PLAN.find((source) => source.key === "kb10")).toMatchObject({
      approvalStatus: "validation_required",
      retrievalPermission: "admin_only",
    });
  });

  it("contains the complete Five Pillars framework", async () => {
    const text = await sourceText("kb01");
    expect(text).toMatch(/Pillar 1.+prevailing trend/);
    expect(text).toMatch(/Pillar 2.+area of confluence/);
    expect(text).toMatch(/Pillar 3.+Control trade size/i);
    expect(text).toMatch(/Pillar 4.+without emotion/i);
    expect(text).toMatch(/Pillar 5.+Account management/i);
  });

  it("contains the Fibonacci rules covered by T036-T038", async () => {
    const text = await sourceText("kb03");
    expect(text).toMatch(/highest-priority levels are 38\.2% and 61\.8%/i);
    expect(text).toMatch(/23\.6%.+50%/);
    expect(text).toMatch(/50% level is not a Fibonacci ratio/i);
    expect(text).toMatch(/only considered broken when price\s+CLOSES outside/i);
    expect(text).toMatch(/Once price has broken beyond 78\.6%/i);
    expect(text).toMatch(/removing the existing Fibonacci lines and redrawing them/i);
    expect(text).toMatch(/does not guarantee a reversal/i);
  });

  it("keeps the Fibonacci quick reference as one retrievable production passage", async () => {
    const text = await sourceText("kb03-retracement-quick-reference");
    expect(text.length).toBeLessThan(1400);
    expect(text).toMatch(/38\.2% and 61\.8%[\s\S]+23\.6%[\s\S]+50%/i);
    expect(text).toMatch(/only considered broken[\s\S]+CLOSES outside/i);
    expect(text).toMatch(/78\.6%[\s\S]+remove the existing Fibonacci lines/i);
    expect(text).toMatch(/does not guarantee a reversal/i);
  });
});
