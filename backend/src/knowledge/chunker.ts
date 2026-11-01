import type { KnowledgeChunkDraft, PlannedSource } from "./types.js";

const TARGET_CHARS = 1400;
const MAX_CHARS = 1800;

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_CHARS) {
      if (current) parts.push(current);
      current = "";
      for (let offset = 0; offset < trimmed.length; offset += MAX_CHARS) {
        parts.push(trimmed.slice(offset, offset + MAX_CHARS));
      }
    } else if (current.length + trimmed.length + 1 > MAX_CHARS) {
      parts.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) parts.push(current);
  return parts.filter(Boolean);
}

export function chunkParagraphs(
  paragraphs: string[],
  source: PlannedSource,
): KnowledgeChunkDraft[] {
  const segments = paragraphs.flatMap((paragraph, index) =>
    splitLong(paragraph.trim()).map((text) => ({
      text,
      paragraphNumber: index + 1,
    })),
  );
  const chunks: KnowledgeChunkDraft[] = [];
  let current: typeof segments = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length === 0) return;
    const first = current[0];
    const last = current.at(-1);
    if (!first || !last) return;
    const paragraphRange = first.paragraphNumber === last.paragraphNumber
      ? `paragraph ${first.paragraphNumber}`
      : `paragraphs ${first.paragraphNumber}-${last.paragraphNumber}`;
    chunks.push({
      chunkIndex: chunks.length,
      locator: `${source.title} — ${paragraphRange}`,
      content: current.map((segment) => segment.text).join("\n\n"),
      authorityLayer: source.authorityLayer,
      approvalStatus: source.approvalStatus,
      retrievalPermission: source.retrievalPermission,
      contentType: source.contentType,
      topicTags: source.topicTags,
      ruleIds: [],
      metadata: { paragraphStart: first.paragraphNumber, paragraphEnd: last.paragraphNumber },
    });
    current = [];
    currentLength = 0;
  };

  for (const segment of segments) {
    if (current.length > 0 && currentLength + segment.text.length > TARGET_CHARS) flush();
    current.push(segment);
    currentLength += segment.text.length;
    if (currentLength >= TARGET_CHARS) flush();
  }
  flush();
  return chunks;
}

