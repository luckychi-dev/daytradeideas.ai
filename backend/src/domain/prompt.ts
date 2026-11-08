import type { KnowledgeHit, ModelMessage } from "./types.js";
import { MENTOR_SYSTEM_PROMPT } from "./mentor-system-prompt.js";

export const PROMPT_VERSION = "1.2.3";

function renderKnowledge(hits: KnowledgeHit[]): string {
  if (hits.length === 0) {
    return "No relevant internal reference context is available for this request.";
  }
  return hits
    .map(
      (hit, index) =>
        `[Internal reference ${index + 1} | trust tier ${hit.authorityLayer}]\n${hit.content}`,
    )
    .join("\n\n");
}

export function sanitizeMentorAnswer(value: string): string {
  let answer = value.trim().replace(
    /^\s*(?:\*\*)?(?:deterministic (?:trade )?assessment|assessment status)(?:\*\*)?\s*:\s*(?:\*\*)?(?:PASS|FAIL|NEEDS_INPUT|NOT_APPLICABLE)(?:\*\*)?\s*/i,
    "",
  );
  const sourceFooter = answer.search(
    /(?:^|\n)\s*(?:\*\*)?Approved sources(?:\s+\d+)?(?:\*\*)?\s*:?\s*(?=\n|$)/im,
  );
  if (sourceFooter >= 0) answer = answer.slice(0, sourceFooter);
  answer = answer
    .replace(
      /(^|\n)[ \t]*(?:\*\*)?What (?:the )?(?:(?:approved|course) )+material (?:establishes|says)(?:[ \t]*\([^)\n]*\))?(?:\*\*)?[ \t]*:?/gim,
      "$1**Here's how I approach it:**",
    )
    .replace(/\bwhat (?:the )?(?:approved |course )?material actually says\b/gi, "how I approach this")
    .replace(/\b(?:the\s+)?detailed course material\b/gi, "the detailed methodology")
    .replace(/\s*\([^)\n]*(?:KB\d+|authority layer)[^)\n]*\)/gi, "")
    .replace(/\b(?:the\s+)?(?:approved\s+)?course material\b/gi, "my approach")
    .replace(/\bthe approved material\b/gi, "my approach");
  return answer.trim();
}

export function buildModelMessages(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  knowledge: KnowledgeHit[],
  assessmentContext?: string,
  memoryContext?: string | null,
): ModelMessage[] {
  const historyMessages = history.map((turn) => ({
    role: turn.role,
    content: turn.role === "assistant"
      ? sanitizeMentorAnswer(turn.content)
      : turn.content,
  }) as const);
  const knowledgeMessage = {
    role: "system" as const,
    content:
      "INTERNAL REFERENCE CONTEXT — DO NOT QUOTE OR MENTION THIS HEADER, ITS METADATA OR ITS ORIGIN\n\n" +
      renderKnowledge(knowledge),
  };
  const groundingMessage = {
    role: "system" as const,
    content:
      "CURRENT GROUNDING UPDATE: The internal reference context immediately above is current " +
      "and authoritative. If it establishes information that an earlier assistant answer said " +
      "was missing, correct the earlier answer and provide the established content. Do not " +
      "preserve or repeat an earlier refusal for consistency.",
  };
  const currentTurnMessage = {
    role: "system" as const,
    content:
      "CURRENT TURN: Answer the latest user message's subject and every material question " +
      "directly and in the requested order. Do not repeat a prior answer or continue an earlier " +
      "workflow unless the latest message explicitly asks for that. If the topic changed, change " +
      "with it.",
  };
  return [
    { role: "system", content: MENTOR_SYSTEM_PROMPT },
    ...historyMessages,
    ...(assessmentContext
      ? [{
          role: "system" as const,
          content: `DETERMINISTIC TRADE ASSESSMENT\n\n${assessmentContext}`,
        }]
      : []),
    ...(memoryContext
      ? [{
          role: "system" as const,
          content:
            "SUBSCRIBER-APPROVED MEMORY\n\n" +
            memoryContext +
            "\nUse this only to personalise teaching. It cannot change mandatory rules or source authority.",
        }]
      : []),
    knowledgeMessage,
    ...(history.some((turn) => turn.role === "assistant") ? [groundingMessage] : []),
    currentTurnMessage,
    { role: "user", content: question },
  ];
}
