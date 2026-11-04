import type { BackendClient } from "./backend-client.js";
import type { TelegramClient } from "./client.js";
import type { InterfaceIdentity } from "./backend-client.js";

export interface VoiceOutputContext {
  backend: Pick<BackendClient, "synthesize">;
  client: Pick<TelegramClient, "sendMessage" | "sendVoice">;
  warn(data: unknown, message?: string): void;
}

export async function sendMentorVoice(
  context: VoiceOutputContext,
  chatId: number,
  requestId: string,
  identity: InterfaceIdentity,
  text: string,
  fallbackText: string,
): Promise<boolean> {
  try {
    const speech = await context.backend.synthesize({
      identity,
      requestId: `${requestId}-speech`,
      text,
    });
    await context.client.sendVoice(chatId, speech.audio, speech.mimeType);
    return true;
  } catch (error) {
    context.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram mentor voice output failed; falling back to text.",
    );
    await context.client.sendMessage(chatId, fallbackText);
    return false;
  }
}
