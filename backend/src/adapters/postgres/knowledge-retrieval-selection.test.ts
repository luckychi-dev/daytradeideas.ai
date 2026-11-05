import { describe, expect, it } from "vitest";
import {
  groupKnowledgeCandidates,
  mergeExpandedKnowledge,
  type RankedKnowledgeRow,
  type StoredKnowledgeRow,
} from "./knowledge-retrieval-selection.js";

function row(
  sourceId: string,
  chunkIndex: number,
  score = 0.5,
): RankedKnowledgeRow {
  return {
    id: `${sourceId}-${chunkIndex}`,
    sourceId,
    sourceTitle: sourceId,
    sourceVersion: "1.0",
    locator: `chunk ${chunkIndex}`,
    authorityLayer: "B",
    content: `Chunk ${chunkIndex}`,
    chunkIndex,
    score,
  };
}

function stored(value: RankedKnowledgeRow): StoredKnowledgeRow {
  return value;
}

describe("knowledge context expansion", () => {
  it("groups ranked chunks by source in score order", () => {
    const groups = groupKnowledgeCandidates([
      row("kb01", 1, 0.9),
      row("canonical", 4, 0.8),
      row("kb01", 2, 0.7),
    ]);

    expect(groups.map((group) => group.sourceId)).toEqual(["kb01", "canonical"]);
    expect(groups[0]?.chunkIndexes).toEqual([1, 2]);
    expect(groups[0]?.rows).toHaveLength(2);
  });

  it("prioritises the complete top source section before secondary matches", () => {
    const candidates = [
      row("kb01", 1, 0.9),
      row("canonical", 4, 0.8),
    ];
    const groups = groupKnowledgeCandidates(candidates);
    const kb01Section = [1, 0, 2, 3, 4, 5, 6, 7].map((index) =>
      stored(row("kb01", index))
    );
    const result = mergeExpandedKnowledge(
      groups,
      [kb01Section, [stored(candidates[1]!)]],
      8,
    );

    expect(result.map((item) => item.id)).toEqual([
      "kb01-1",
      "kb01-0",
      "kb01-2",
      "kb01-3",
      "kb01-4",
      "kb01-5",
      "canonical-4",
      "kb01-6",
    ]);
  });

  it("deduplicates candidate chunks already included by expansion", () => {
    const candidates = [row("kb01", 2), row("kb02", 1)];
    const groups = groupKnowledgeCandidates(candidates);
    const result = mergeExpandedKnowledge(
      groups,
      [[stored(candidates[0]!), stored(row("kb01", 3))], [stored(candidates[1]!)]],
      3,
    );

    expect(result.map((item) => item.id)).toEqual(["kb01-2", "kb01-3", "kb02-1"]);
  });
});
