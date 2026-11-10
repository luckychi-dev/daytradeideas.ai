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
    expect(SOURCE_PLAN.find((source) => source.key === "canonical-rules")).toMatchObject({
      version: "1.1",
      approvalStatus: "approved",
      retrievalPermission: "production_teaching",
    });
    expect(SOURCE_PLAN.find((source) => source.key === "master-instructions")?.relativePath)
      .toContain("Master_Instructions_v1.1.docx");
    expect(SOURCE_PLAN.find((source) => source.key === "kb04")?.relativePath)
      .toContain("KB04_Trade_Execution_and_Risk_Management_v0.4.docx");
    expect(SOURCE_PLAN.find((source) => source.key === "kb05")?.relativePath)
      .toContain("KB05_Trading_Psychology_v0.4.docx");
  });

  it("contains the complete Five Pillars framework", async () => {
    const text = await sourceText("kb01");
    expect(text).toMatch(/Pillar 1.+prevailing trend/);
    expect(text).toMatch(/Pillar 2.+area of confluence/);
    expect(text).toMatch(/Pillar 3.+Control trade size/i);
    expect(text).toMatch(/Pillar 4.+without emotion/i);
    expect(text).toMatch(/Pillar 5.+Account management/i);
  });

  it("contains the complete Five Tools framework", async () => {
    const text = await sourceText("kb02");
    for (const tool of [
      "Fibonacci lines",
      "Trend lines",
      "Moving averages",
      "Patterns",
      "Price action",
    ]) {
      expect(text).toContain(tool);
    }
    expect(text).toMatch(/not a mechanical checklist requiring all five to agree/i);
    expect(text).toMatch(/no fixed minimum number of confirmations/i);
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

  it("contains the addendum stop, target and partial-exit clarifications", async () => {
    const text = (await sourceText("kb04")).replace(/\s+/g, " ");
    expect(text).toContain("permission threshold, not an instruction to move immediately");
    expect(text).toContain("Partial exits are optional and plan-dependent");
    expect(text).toMatch(/do not require every target or remaining fragment to pass 1\.5:1/i);
    expect(text).toMatch(/do not require one method to be selected before entry/i);
  });

  it("contains the addendum account-limit and re-entry clarifications", async () => {
    const text = (await sourceText("kb06")).replace(/\s+/g, " ");
    expect(text).toMatch(/count the full actual realised loss/i);
    expect(text).toContain("does not lift a limit suspension");
    expect(text).toMatch(/stop-out does not automatically prohibit a fresh trade/i);
    expect(text).toMatch(/no universal waiting period or daily trade cap/i);
  });

  it("contains the Round 2 source-discipline corrections", async () => {
    const text = (await sourceText("kb04")).replace(/\s+/g, " ");
    expect(text).toContain(
      "does not specify whether a trader may switch from measured trailing to staged management",
    );
    expect(text).toContain(
      "Do not present switching as either permitted or prohibited",
    );
    expect(text).not.toMatch(/keep the methods from being reassessed/i);
    expect(text).not.toMatch(/shared stop\/invalidation/i);
    expect(text).toContain(
      "A shared stop is not an additional requirement",
    );
    expect(text).toContain(
      "Distinguish inputs needed to assess technical validity from inputs needed to calculate exact position size",
    );
    expect(text).toContain("The course recommends writing down the plan");
    expect(text).toContain(
      "Do not infer a shared driver solely from instrument names",
    );
  });

  it("contains the consolidated Round 2 psychology corrections", async () => {
    const text = (await sourceText("kb05")).replace(/\s+/g, " ");
    expect(text).toContain(
      "does not require a specific stop-management method to be selected before entry",
    );
    expect(text).toContain(
      "The course recommends writing down the trading plan",
    );
    expect(text).toContain(
      "treat position size as one possibility to verify, not the assumed cause",
    );
    expect(text).not.toMatch(/selected stop-management method/i);
  });

  it("contains the Round 3 risk and psychology source corrections", async () => {
    const risk = (await sourceText("kb04")).replace(/\s+/g, " ");
    expect(risk).toMatch(
      /older 1:2 guidance is historical and subordinate to the current 1\.5:1/i,
    );
    expect(risk).toContain(
      "Concentration and combined exposure are considerations",
    );
    expect(risk).toContain(
      "Do not introduce correlation statistics or claimed market behaviour",
    );
    expect(risk).toContain(
      "Do not recast that gap as permission, prohibition",
    );

    const psychology = (await sourceText("kb05")).replace(/\s+/g, " ");
    expect(psychology).toContain(
      "does not establish a canonical five-part classification",
    );
    expect(psychology).toContain("fear and greed as primary emotions");
    expect(psychology).toMatch(/impatience.*perfectionism/i);
    expect(psychology).toContain("revenge trading in its own module");
  });
});
