import type { AuthState } from "./backend-client.js";
import type { InlineKeyboardMarkup } from "./client.js";

export const WELCOME = `Welcome to Jason Sen AI Mentor.

I am your 24/7 AI assistant for Jason Sen's Day Trade Ideas approach.`;

export const WELCOME_CAPTION = `${WELCOME}

Tap "Link my account" to get started.`;

export const HELP = `Ask a trading education, risk or trade-management question.

For a trade assessment, provide the instrument, direction, entry, stop, target, risk allowance and remaining daily/weekly/monthly loss allowances. I will ask for one missing fact at a time rather than invent it.

Send a voice note, or ask me to reply by voice.

Commands: /start, /plans, /verify, /unbind, /help, /memory`;

export const EMAIL_PROMPT = `Send the email address registered on your Day Trade Ideas account.`;

export const CODE_PROMPT = `Enter the six-digit code sent to your email.`;

export const VERIFIED = `✅ Account linked. You're ready to chat.`;

export const INACTIVE = `No active membership was found for that email. Choose a plan below, then link the subscribed email.`;

export const ACCOUNT_IN_USE = `This subscription is already linked to another Telegram session.

Tap "Use Here Instead" only if you want to disconnect the other session and move the account to this Telegram chat.`;

export function linkAccountKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{
      text: "Link my account",
      callback_data: "verify_subscription",
    }]],
  };
}

export function useHereKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{
      text: "Use Here Instead",
      callback_data: "claim_subscription",
    }]],
  };
}

export function authPrompt(state: AuthState): string {
  if (state === "awaiting_otp") return CODE_PROMPT;
  if (state === "inactive") return `${INACTIVE}\n\n${EMAIL_PROMPT}`;
  return EMAIL_PROMPT;
}
