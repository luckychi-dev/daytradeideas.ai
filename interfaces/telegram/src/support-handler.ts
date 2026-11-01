import {
  BackendRequestError,
  type BackendClient,
  type InterfaceIdentity,
  type PlanLink,
} from "./backend-client.js";
import type { InlineKeyboardMarkup, TelegramClient } from "./client.js";
import { linkAccountKeyboard } from "./replies.js";

interface SupportDependencies {
  backend: BackendClient;
  client: TelegramClient;
  warn(data: unknown, message?: string): void;
}

function planKeyboard(plans: PlanLink[], includeVerify: boolean): InlineKeyboardMarkup {
  const planRows = plans.slice(0, 3).map((plan) => [{
    text: plan.name.length > 48 ? `${plan.name.slice(0, 45)}…` : plan.name,
    url: plan.purchaseUrl,
  }]);
  return {
    inline_keyboard: [
      ...planRows,
      ...(includeVerify
        ? linkAccountKeyboard().inline_keyboard
        : []),
    ],
  };
}

export async function handlePublicSupport(
  dependencies: SupportDependencies,
  updateId: number,
  chatId: number,
  identity: InterfaceIdentity,
  text: string,
  options: { includeVerify?: boolean } = {},
): Promise<void> {
  await dependencies.client.sendTyping(chatId);
  try {
    const response = await dependencies.backend.supportChat({
      identity,
      text,
      requestId: `telegram-support-${updateId}`,
    });
    const includeVerify = options.includeVerify ?? true;
    await dependencies.client.sendMessage(
      chatId,
      response.text + (
        includeVerify ? "\n\nAlready subscribed? Link your account to continue." : ""
      ),
      planKeyboard(response.plans, includeVerify),
    );
  } catch (error) {
    if (error instanceof BackendRequestError) {
      const message = error.code === "daily_message_limit_reached"
        ? "You have reached today's support message limit."
        : error.code === "monthly_budget_reached"
          ? "Support is temporarily unavailable."
          : "I couldn't answer that support question safely. Please try again.";
      await dependencies.client.sendMessage(chatId, message);
      return;
    }
    dependencies.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram public support failed.",
    );
    await dependencies.client.sendMessage(
      chatId,
      "I couldn't answer that support question safely. Please try again shortly.",
    );
  }
}
