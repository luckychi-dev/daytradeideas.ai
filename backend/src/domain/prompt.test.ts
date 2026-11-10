import { describe, expect, it } from "vitest";
import {
  buildModelMessages,
  sanitizeMentorAnswer,
} from "./prompt.js";

const knowledge = [{
  id: "chunk-a",
  sourceId: "source-kb07",
  sourceTitle: "Day_Trade_Ideas_AI_KB07_News_and_Market_Conditions_v0.1",
  sourceVersion: "0.1",
  locator: "paragraphs 35-48",
  authorityLayer: "C" as const,
  content: "If there is no specific plan for trading news, stand aside.",
}];

describe("mentor answer voice", () => {
  it("keeps source metadata and internal assessment labels out of model context", () => {
    const messages = buildModelMessages(
      "Does news matter?",
      [{
        role: "assistant",
        content: "Deterministic assessment: NEEDS_INPUT\n\nWhat is your plan?",
      }],
      knowledge,
      "Status: NEEDS_INPUT\nMissing fields: direction",
    );
    const content = messages.map((message) => message.content).join("\n");
    const systemPrompt = messages[0]?.content.replace(/\s+/g, " ");

    expect(content).toContain("If there is no specific plan");
    expect(content).not.toContain(knowledge[0].sourceTitle);
    expect(content).not.toContain("KB07");
    expect(content).not.toContain("paragraphs 35-48");
    expect(messages).toContainEqual({
      role: "assistant",
      content: "What is your plan?",
    });
    expect(messages[0]?.content).toContain("Let me tell you based on my knowledge");
    expect(messages[0]?.content).toContain("Never mention approved sources");
    expect(messages[0]?.content).toContain("Never claim to be text-only");
    expect(messages[0]?.content).toContain("spoken voice note");
    expect(messages[0]?.content).toContain(
      "Never define, explain or elaborate a named trading method",
    );
    expect(systemPrompt).toContain(
      "methodology does not specify whether switching is permitted or prohibited",
    );
    expect(systemPrompt).toContain(
      "Do not infer a shared market driver or correlation from instrument names",
    );
    expect(systemPrompt).toContain(
      "Older 1:2 guidance is historical and subordinate",
    );
    expect(systemPrompt).toContain(
      "Concentration and combined exposure are considerations",
    );
    expect(systemPrompt).toContain(
      "does not establish a five-part taxonomy",
    );
    expect(systemPrompt).toContain(
      'a "not a breach" conclusion',
    );
    expect(messages[0]?.content).toContain(
      "Earlier assistant turns are conversational context, not authoritative evidence",
    );
    expect(messages[0]?.content).toContain(
      "Do not infer that unease means position size is excessive",
    );
    expect(messages[0]?.content).toContain(
      "answer that gate directly",
    );
    expect(messages.map((message) => message.content).join("\n")).toContain(
      "CURRENT GROUNDING UPDATE",
    );
    expect(messages.at(-3)?.content).toContain("CURRENT GROUNDING UPDATE");
    expect(messages.at(-2)?.content).toContain("CURRENT TURN");
    expect(messages.at(-1)).toEqual({ role: "user", content: "Does news matter?" });
  });

  it("removes legacy assessment prefixes and source footers from visible text", () => {
    expect(sanitizeMentorAnswer(
      "Deterministic assessment: FAIL\n\nThe stop-loss gate failed.",
    )).toBe("The stop-loss gate failed.");
    expect(sanitizeMentorAnswer(
      "Here is how I approach it.\n\n**Approved sources 8**\n- KB07\n- KB02",
    )).toBe("Here is how I approach it.");
  });

  it("rewrites legacy source framing into the mentor's own voice", () => {
    const answer = sanitizeMentorAnswer(
      "Let me be precise about what the approved material actually says.\n\n" +
      "**What the course material establishes (KB07, authority layer C)**\n\n" +
      "- If there is no plan, stand aside.",
    );

    expect(answer).toBe(
      "Let me be precise about how I approach this.\n\n" +
      "**Here's how I approach it:**\n\n" +
      "- If there is no plan, stand aside.",
    );
    expect(sanitizeMentorAnswer("Use the detailed course material.")).toBe(
      "Use the detailed methodology.",
    );
  });
});
