import {
  BackendClient,
  type AuthState,
} from "./backend-client.js";
import { TelegramAuthHandler } from "./auth-handler.js";
import { TelegramClient } from "./client.js";
import { handleAccountCommand } from "./account-command-handler.js";
import {
  HELP,
  WELCOME,
  linkAccountKeyboard,
} from "./replies.js";
import { telegramUpdateSchema } from "./update-schema.js";
import { handlePublicSupport } from "./support-handler.js";
import { toInterfaceIdentity } from "./telegram-identity.js";
import { handleVoice } from "./voice-handler.js";
import { handleImage, imageFromMessage } from "./image-handler.js";
import { handleText } from "./text-handler.js";

export interface TelegramLogger {
  warn(data: unknown, message?: string): void;
}

export class TelegramHandler {
  private readonly auth: TelegramAuthHandler;

  constructor(
    private readonly backend: BackendClient,
    private readonly client: TelegramClient,
    private readonly logger: TelegramLogger,
    welcomeImageUrl?: string,
    welcomeImagePath?: string,
  ) {
    this.auth = new TelegramAuthHandler({
      backend,
      client,
      ...(welcomeImageUrl ? { welcomeImageUrl } : {}),
      ...(welcomeImagePath ? { welcomeImagePath } : {}),
      warn: logger.warn.bind(logger),
    });
  }

  async handle(rawUpdate: unknown): Promise<void> {
    const parsed = telegramUpdateSchema.safeParse(rawUpdate);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, "Rejected malformed Telegram update.");
      return;
    }
    if (parsed.data.callback_query) {
      await this.handleCallback(parsed.data.callback_query);
      return;
    }
    const message = parsed.data.message;
    if (!message?.from || message.chat.type !== "private") return;
    const image = imageFromMessage(message);
    if (!message.text && !message.voice && !image) return;
    const identity = toInterfaceIdentity(message.from);
    const command = message.text?.split(/\s+/, 1)[0]?.split("@")[0]?.toLowerCase();
    if (await handleAccountCommand(
      { backend: this.backend, client: this.client, warn: this.logger.warn.bind(this.logger) },
      parsed.data.update_id,
      message.chat.id,
      identity,
      command,
    )) return;
    let state: AuthState;
    try {
      state = await this.backend.authStatus(identity);
    } catch (error) {
      await this.serviceUnavailable(message.chat.id, error);
      return;
    }
    if (state !== "active") {
      const handled = await this.auth.handle(
        message.chat.id,
        identity,
        state,
        message.text?.trim() ?? "",
      );
      if (handled) return;
      if (image) {
        await this.client.sendMessage(
          message.chat.id,
          "Please verify your subscription before sending a chart for analysis.",
          linkAccountKeyboard(),
        );
        return;
      }
      if (message.voice) {
        await this.client.sendMessage(
          message.chat.id,
          "Link your subscription to use voice notes with the mentor.",
          linkAccountKeyboard(),
        );
        return;
      }
      if (message.text) {
        await handlePublicSupport(
          {
            backend: this.backend,
            client: this.client,
            warn: this.logger.warn.bind(this.logger),
          },
          parsed.data.update_id,
          message.chat.id,
          identity,
          message.text,
        );
      }
      return;
    }

    if (command === "/start") {
      await this.client.sendMessage(message.chat.id, WELCOME);
      return;
    }
    if (command === "/help") {
      await this.client.sendMessage(message.chat.id, HELP);
      return;
    }
    if (command === "/memory") {
      await this.client.sendMessage(
        message.chat.id,
        "Persistent memory is currently off. This build does not save a personal profile between sessions.",
      );
      return;
    }
    if (command === "/verify") {
      await this.client.sendMessage(message.chat.id, "Your subscription is already verified.");
      return;
    }
    if (message.voice) {
      await handleVoice(
        { backend: this.backend, client: this.client, warn: this.logger.warn.bind(this.logger) },
        parsed.data.update_id,
        message.chat.id,
        identity,
        message.voice,
      );
      return;
    }
    if (image) {
      await handleImage(
        { backend: this.backend, client: this.client, warn: this.logger.warn.bind(this.logger) },
        parsed.data.update_id,
        message.chat.id,
        identity,
        image,
        message.caption,
      );
      return;
    }
    if (!message.text) return;

    await handleText(
      { backend: this.backend, client: this.client, warn: this.logger.warn.bind(this.logger) },
      parsed.data.update_id,
      message.chat.id,
      identity,
      message.text,
    );
  }

  private async handleCallback(
    callback: NonNullable<ReturnType<typeof telegramUpdateSchema.parse>["callback_query"]>,
  ): Promise<void> {
    const chatId = callback.message?.chat.id ?? callback.from.id;
    if (callback.data !== "verify_subscription" || !callback.message) {
      await this.client.answerCallbackQuery(callback.id);
      return;
    }
    const identity = toInterfaceIdentity(callback.from);
    try {
      const state = await this.backend.authStatus(identity);
      await this.auth.handleButton(
        callback.id,
        chatId,
        callback.message.message_id,
        identity,
        state,
      );
    } catch (error) {
      await this.client.answerCallbackQuery(callback.id, "Service temporarily unavailable.");
      await this.serviceUnavailable(chatId, error);
    }
  }

  private async serviceUnavailable(chatId: number, error: unknown): Promise<void> {
    this.logger.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Backend auth status failed.",
    );
    await this.client.sendMessage(
      chatId,
      "The subscription verification service is temporarily unavailable.",
    );
  }
}
