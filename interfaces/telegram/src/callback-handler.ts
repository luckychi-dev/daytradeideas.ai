import type { BackendClient } from "./backend-client.js";
import type { TelegramAuthHandler } from "./auth-handler.js";
import type { TelegramClient } from "./client.js";
import { toInterfaceIdentity } from "./telegram-identity.js";
import type { TelegramUpdate } from "./update-schema.js";

type TelegramCallback = NonNullable<TelegramUpdate["callback_query"]>;

interface CallbackDependencies {
  backend: BackendClient;
  client: TelegramClient;
  auth: TelegramAuthHandler;
  serviceUnavailable(chatId: number, error: unknown): Promise<void>;
}

export async function handleCallback(
  dependencies: CallbackDependencies,
  callback: TelegramCallback,
): Promise<void> {
  const chatId = callback.message?.chat.id ?? callback.from.id;
  if (callback.data === "claim_subscription" && callback.message) {
    await dependencies.auth.handleTakeover(
      callback.id,
      chatId,
      callback.message.message_id,
      toInterfaceIdentity(callback.from),
    );
    return;
  }
  if (callback.data !== "verify_subscription" || !callback.message) {
    await dependencies.client.answerCallbackQuery(callback.id);
    return;
  }
  const identity = toInterfaceIdentity(callback.from);
  try {
    const state = await dependencies.backend.authStatus(identity);
    await dependencies.auth.handleButton(
      callback.id,
      chatId,
      callback.message.message_id,
      identity,
      state,
    );
  } catch (error) {
    await dependencies.client.answerCallbackQuery(callback.id, "Service temporarily unavailable.");
    await dependencies.serviceUnavailable(chatId, error);
  }
}
