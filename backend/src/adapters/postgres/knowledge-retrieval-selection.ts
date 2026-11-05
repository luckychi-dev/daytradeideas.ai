export interface StoredKnowledgeRow {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
  authorityLayer: "A" | "B" | "C" | "D" | "E" | "F";
  content: string;
  chunkIndex: number;
}

export interface RankedKnowledgeRow extends StoredKnowledgeRow {
  score: number;
}

export interface CandidateGroup {
  sourceId: string;
  chunkIndexes: number[];
  rows: RankedKnowledgeRow[];
  titleMatch: boolean;
}

const GENERIC_TITLE_TERMS = new Set([
  "ai", "core", "day", "ideas", "knowledge", "module", "successful", "trade",
]);

function distinctiveTitleMatch(title: string, terms: string[]): boolean {
  const titleTerms = new Set(title.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
  return terms.some((term) =>
    !GENERIC_TITLE_TERMS.has(term) &&
    !/^kb\d+$/.test(term) &&
    titleTerms.has(term)
  );
}

export function groupKnowledgeCandidates(
  candidates: RankedKnowledgeRow[],
  queryTerms: string[] = [],
): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup>();
  for (const row of candidates) {
    const group = groups.get(row.sourceId);
    if (group) {
      group.rows.push(row);
      if (!group.chunkIndexes.includes(row.chunkIndex)) {
        group.chunkIndexes.push(row.chunkIndex);
      }
    } else {
      groups.set(row.sourceId, {
        sourceId: row.sourceId,
        chunkIndexes: [row.chunkIndex],
        rows: [row],
        titleMatch: distinctiveTitleMatch(row.sourceTitle, queryTerms),
      });
    }
  }
  return [...groups.values()];
}

export function mergeExpandedKnowledge(
  groups: CandidateGroup[],
  expansions: StoredKnowledgeRow[][],
  limit: number,
): StoredKnowledgeRow[] {
  const selected: StoredKnowledgeRow[] = [];
  const selectedIds = new Set<string>();
  const selectedBySource = new Map<string, number>();
  const append = (
    rows: StoredKnowledgeRow[],
    sourceId: string,
    maximum = Number.POSITIVE_INFINITY,
  ): void => {
    for (const row of rows) {
      const sourceCount = selectedBySource.get(sourceId) ?? 0;
      if (selected.length >= limit || sourceCount >= maximum) return;
      if (selectedIds.has(row.id)) continue;
      selected.push(row);
      selectedIds.add(row.id);
      selectedBySource.set(sourceId, sourceCount + 1);
    }
  };

  const secondaryQuota = Math.floor(limit / 4);
  for (const [index, group] of groups.entries()) {
    const maximum = index === 0
      ? (group.titleMatch ? limit : limit - secondaryQuota)
      : secondaryQuota;
    if (group.titleMatch) {
      append(expansions[index] ?? [], group.sourceId, maximum);
      append(group.rows, group.sourceId, maximum);
    } else {
      append(group.rows, group.sourceId, maximum);
      append(expansions[index] ?? [], group.sourceId, maximum);
    }
  }
  for (const group of groups) append(group.rows, group.sourceId);
  for (const [index, expansion] of expansions.entries()) {
    const group = groups[index];
    if (group) append(expansion, group.sourceId);
  }
  return selected;
}
