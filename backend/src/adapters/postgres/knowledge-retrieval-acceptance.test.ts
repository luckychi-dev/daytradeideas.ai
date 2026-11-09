import { afterAll, describe, expect, it } from "vitest";
import { createPool } from "../../db/database.js";
import { PostgresKnowledgeRepository } from "./knowledge-repository.js";

const databaseUrl = process.env.RETRIEVAL_TEST_DATABASE_URL;
const pool = databaseUrl ? createPool(databaseUrl) : null;
const repository = pool ? new PostgresKnowledgeRepository(pool) : null;

describe.skipIf(!repository)("approved knowledge retrieval acceptance", () => {
  afterAll(async () => {
    await pool?.end();
  });

  it("F02 returns the complete Five Tools passage", async () => {
    const hits = await repository!.search(
      "What are the five technical-analysis tools? Briefly explain each.",
      8,
    );
    const fiveTools = hits.find((hit) =>
      ["Fibonacci lines", "Trend lines", "Moving averages", "Patterns", "Price action"]
        .every((tool) => hit.content.includes(tool))
    );

    expect(fiveTools?.sourceTitle).toContain("KB02");
    expect(hits[0]?.sourceTitle).toContain("KB02");
  });

  it("F01 returns the explicit switching-gap rule", async () => {
    const hits = await repository!.search(
      "Can I switch from measured trailing to staged management mid-trade?",
      8,
    );
    const switchGap = hits.find((hit) =>
      hit.content.includes(
        "does not specify whether a trader may switch from measured trailing to staged management",
      )
    );

    expect(switchGap?.sourceTitle).toContain("KB04");
  });
});
