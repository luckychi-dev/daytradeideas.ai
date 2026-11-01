import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { readCanonicalChunks } from "./canonical-reader.js";
import { SOURCE_PLAN } from "./source-plan.js";

describe("canonical rule ingestion", () => {
  it("keeps confirmed rules production-eligible and gaps admin-only", async () => {
    const source = SOURCE_PLAN.find((item) => item.kind === "canonical-rules");
    if (!source) throw new Error("Canonical source is missing.");
    const path = fileURLToPath(new URL(`../../../${source.relativePath}`, import.meta.url));
    const chunks = await readCanonicalChunks(path, source);
    expect(chunks.length).toBeGreaterThan(20);
    expect(chunks).toContainEqual(expect.objectContaining({
      ruleIds: ["RISK-001"],
      approvalStatus: "approved",
      retrievalPermission: "production_teaching",
    }));
    expect(chunks.some((chunk) => chunk.retrievalPermission === "admin_only")).toBe(true);
  });
});

