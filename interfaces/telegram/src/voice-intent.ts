export function wantsVoiceReply(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return [
    /\b(?:send|reply|respond|answer|leave|record|make|give)\b.*\b(?:voice|audio)\b/,
    /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:send|reply|respond|answer|speak|talk|record|leave|make|give)\b.*\b(?:voice|audio)\b/,
    /\b(?:reply|respond|answer|speak|talk)\b\s+(?:to me\s+)?(?:by|in)\s+(?:voice|audio)\b/,
    /\b(?:voice|audio)\s*(?:message|note|reply)\b.*\b(?:please|now)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function ensureVoiceCapabilityAnswer(answer: string): string {
  const claimsTextOnly = /\btext[- ]based\b|\b(?:written|text)\s+(?:form|only)\b/i
    .test(answer);
  const deniesVoice = /\b(?:voice|audio)\b/i.test(answer) &&
    /\b(?:cannot|can't|unable|not able)\b/i.test(answer);
  if (!claimsTextOnly && !deniesVoice) return answer;
  return "Yes, I can reply by voice. Tell me what trading question or setup " +
    "you want me to work through, and I'll give you a clear spoken answer.";
}
