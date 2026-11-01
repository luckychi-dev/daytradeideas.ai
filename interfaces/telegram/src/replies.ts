import type { ChatSource, AuthState } from "./backend-client.js";
import type { InlineKeyboardMarkup } from "./client.js";

export const WELCOME = `Welcome to Jason Sen AI Mentor.

I am your 24/7 AI assistant, grounded in Jason Sen's approved Day Trade Ideas knowledge.`;

export const WELCOME_CAPTION = `${WELCOME}

Tap "Link my account" to get started.`;

export const HELP = `Ask a trading education, risk or trade-management question.

For a trade assessment, provide the instrument, direction, entry, stop, target, risk allowance and remaining daily/weekly/monthly loss allowances. I will ask for one missing fact at a time rather than invent it.

Commands: /start, /plans, /verify, /unbind, /help, /memory`;

export const EMAIL_PROMPT = `Send the email address registered on your Day Trade Ideas account.`;

export const CODE_PROMPT = `Enter the six-digit code sent to your email.`;

export const VERIFIED = `✅ Account linked. You're ready to chat.`;

export const INACTIVE = `No active membership was found for that email. Choose a plan below, then link the subscribed email.`;

export const EMAIL_ALREADY_LINKED = `That subscription email is already linked to a different Telegram account. Contact Day Trade Ideas support if you need the link reset.`;

export function linkAccountKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{
      text: "Link my account",
      callback_data: "verify_subscription",
    }]],
  };
}

export function authPrompt(state: AuthState): string {
  if (state === "awaiting_otp") return CODE_PROMPT;
  if (state === "inactive") return `${INACTIVE}\n\n${EMAIL_PROMPT}`;
  return EMAIL_PROMPT;
}

export function sourcesFooter(hits: ChatSource[]): string {
  const unique = new Map<string, ChatSource>();
  for (const hit of hits) unique.set(hit.sourceId, hit);
  if (unique.size === 0) return "";
  const lines = [...unique.values()]
    .slice(0, 3)
    .map((hit) => `- ${hit.sourceTitle} (${hit.sourceVersion}), ${hit.locator}`);
  return `\n\nApproved sources:\n${lines.join("\n")}`;
}
