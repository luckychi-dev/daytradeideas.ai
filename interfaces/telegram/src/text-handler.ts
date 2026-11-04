import {
  BackendRequestError,
  BackendClient,
  SubscriberNotAllowedError,
  type InterfaceIdentity,
} from "./backend-client.js";
import { backendErrorMessage } from "./backend-errors.js";
import { TelegramClient } from "./client.js";
import { authPrompt, linkAccountKeyboard } from "./replies.js";
import { ensureVoiceCapabilityAnswer, wantsVoiceReply } from "./voice-intent.js";
import { sendMentorVoice } from "./voice-output.js";

export interface TextHandlerContext {
  backend: BackendClient;
  client: TelegramClient;
  warn(data: unknown, message?: string): void;
}

export async function handleText(
  context: TextHandlerContext,
  updateId: number,
  chatId: number,
  identity: InterfaceIdentity,
  text: string,
): Promise<void> {
  await context.client.sendTyping(chatId);
  try {
    const response = await context.backend.chat({
      identity,
      text,
      requestId: `telegram-${updateId}`,
    });
    if (wantsVoiceReply(text)) {
      const spokenText = ensureVoiceCapabilityAnswer(response.text);
      await sendMentorVoice(
        context,
        chatId,
        `telegram-${updateId}`,
        identity,
        spokenText,
        spokenText,
      );
      return;
    }
    await context.client.sendMessage(chatId, response.text);
  } catch (error) {
    if (error instanceof SubscriberNotAllowedError) {
      await context.client.sendMessage(
        chatId,
        authPrompt("inactive"),
        linkAccountKeyboard(),
      );
      return;
    }
    if (error instanceof BackendRequestError) {
      await context.client.sendMessage(chatId, backendErrorMessage(error.code));
      return;
    }
    context.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram mentor reply failed.",
    );
    await context.client.sendMessage(
      chatId,
      "I couldn't complete that answer safely. Please try again shortly.",
    );
  }
}
