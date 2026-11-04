import {
  BackendRequestError,
  BackendClient,
  SubscriberNotAllowedError,
  VoiceTranscriptionUnavailableError,
  type InterfaceIdentity,
} from "./backend-client.js";
import { TelegramClient } from "./client.js";
import { linkAccountKeyboard } from "./replies.js";
import { sendMentorVoice } from "./voice-output.js";

export interface TelegramVoice {
  file_id: string;
  duration: number;
  mime_type?: string | undefined;
  file_size?: number | undefined;
}

export interface VoiceHandlerContext {
  backend: BackendClient;
  client: TelegramClient;
  warn(data: unknown, message?: string): void;
}

export async function handleVoice(
  context: VoiceHandlerContext,
  updateId: number,
  chatId: number,
  identity: InterfaceIdentity,
  voice: TelegramVoice,
): Promise<void> {
  const maximumBytes = 6 * 1024 * 1024;
  if ((voice.file_size ?? 0) > maximumBytes || voice.duration > 600) {
    await context.client.sendMessage(chatId, "That voice note is too large or too long.");
    return;
  }
  await context.client.sendTyping(chatId);
  try {
    const audio = await context.client.downloadFile(voice.file_id);
    if (audio.byteLength > maximumBytes) {
      await context.client.sendMessage(chatId, "That voice note is too large.");
      return;
    }
    const response = await context.backend.chatVoice({
      identity,
      requestId: `telegram-voice-${updateId}`,
      audio,
      mimeType: voice.mime_type ?? "audio/ogg",
      durationSeconds: voice.duration,
    });
    await sendMentorVoice(
      context,
      chatId,
      `telegram-voice-${updateId}`,
      identity,
      response.text,
      `Voice transcript:\n${response.transcript}\n\n${response.text}`,
    );
  } catch (error) {
    if (error instanceof SubscriberNotAllowedError) {
      await context.client.sendMessage(
        chatId,
        "Your subscription needs to be linked again before voice notes can continue.",
        linkAccountKeyboard(),
      );
      return;
    }
    if (error instanceof VoiceTranscriptionUnavailableError) {
      await context.client.sendMessage(
        chatId,
        "Voice transcription is not configured yet. Please send a text message for now.",
      );
      return;
    }
    if (error instanceof BackendRequestError) {
      const message = error.code === "monthly_budget_reached"
        ? "The AI service has reached its configured monthly budget."
        : error.code === "daily_voice_limit_reached"
          ? "You have reached today's voice-note limit."
          : error.code === "no_speech_detected"
            ? "I couldn't hear any speech in that voice note. Please try again and speak a little closer to the microphone."
          : "I couldn't complete that voice request safely.";
      await context.client.sendMessage(chatId, message);
      return;
    }
    context.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram voice request failed.",
    );
    await context.client.sendMessage(
      chatId,
      "I couldn't process that voice note safely. Please try again or send text.",
    );
  }
}
