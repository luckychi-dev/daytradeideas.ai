import { describe, expect, it } from "vitest";
import { ensureVoiceCapabilityAnswer, wantsVoiceReply } from "./voice-intent.js";

describe("Telegram voice request intent", () => {
  it.each([
    "Hi, can you send me a voice message?",
    "Please reply by voice.",
    "Voice note please",
    "Could you answer that in audio?",
  ])("recognises an explicit spoken reply request: %s", (text) => {
    expect(wantsVoiceReply(text)).toBe(true);
  });

  it.each([
    "How do voice notes work?",
    "Explain the reward-to-risk rule.",
    "Can you send me the plan details?",
  ])("keeps ordinary text chat as text: %s", (text) => {
    expect(wantsVoiceReply(text)).toBe(false);
  });

  it("replaces a stale text-only refusal with a voice-capable answer", () => {
    expect(ensureVoiceCapabilityAnswer(
      "I can't send voice messages because I'm a text-based mentor.",
    )).toMatch(/^Yes, I can reply by voice/);
    expect(ensureVoiceCapabilityAnswer(
      "Keep planned risk consistent and use a stop order.",
    )).toBe("Keep planned risk consistent and use a stop order.");
  });
});
