import { readFile } from "node:fs/promises";
import {
  AuthFlowError,
  type AuthState,
  type BackendClient,
  type InterfaceIdentity,
} from "./backend-client.js";
import type { TelegramClient } from "./client.js";
import { handlePublicSupport } from "./support-handler.js";
import {
  CODE_PROMPT,
  EMAIL_ALREADY_LINKED,
  EMAIL_PROMPT,
  INACTIVE,
  VERIFIED,
  WELCOME_CAPTION,
  authPrompt,
  linkAccountKeyboard,
} from "./replies.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthHandlerDependencies {
  backend: BackendClient;
  client: TelegramClient;
  welcomeImageUrl?: string;
  welcomeImagePath?: string;
  warn(data: unknown, message?: string): void;
}

export class TelegramAuthHandler {
  constructor(private readonly deps: AuthHandlerDependencies) {}

  async handle(
    chatId: number,
    identity: InterfaceIdentity,
    state: AuthState,
    text: string,
  ): Promise<boolean> {
    const command = text.split(/\s+/, 1)[0]?.toLowerCase();
    if (command === "/start" || command === "/verify") {
      await this.sendWelcome(chatId, state);
      return true;
    }
    if (state === "awaiting_otp" && /^\d{6}$/.test(text)) {
      try {
        const result = await this.deps.backend.verifyCode(identity, text);
        if (result.active) {
          await this.deps.client.sendMessage(chatId, VERIFIED);
        } else {
          await this.deps.client.sendMessage(chatId, INACTIVE);
          await handlePublicSupport(
            this.deps,
            Date.now(),
            chatId,
            identity,
            "Show all available membership plans and explain how to subscribe.",
            { includeVerify: true },
          );
        }
      } catch (error) {
        await this.sendError(chatId, error);
      }
      return true;
    }
    if (EMAIL_PATTERN.test(text)) {
      try {
        await this.deps.backend.requestCode(identity, text);
        await this.deps.client.sendMessage(chatId, CODE_PROMPT);
      } catch (error) {
        await this.sendError(chatId, error);
      }
      return true;
    }
    if (state === "awaiting_otp") {
      await this.deps.client.sendMessage(chatId, CODE_PROMPT);
      return true;
    }
    return false;
  }

  async handleButton(
    callbackId: string,
    chatId: number,
    messageId: number,
    identity: InterfaceIdentity,
    state: AuthState,
  ): Promise<void> {
    await this.deps.client.answerCallbackQuery(callbackId);
    await this.deps.client.editMessageReplyMarkup(chatId, messageId);
    if (state === "active") {
      await this.deps.client.sendMessage(
        chatId,
        "Your account is already linked. The verification form is closed — continue in this chat.",
      );
      return;
    }
    await this.deps.client.sendMessage(chatId, authPrompt(state));
  }

  private async sendWelcome(chatId: number, state: AuthState): Promise<void> {
    if (state === "awaiting_otp") {
      await this.deps.client.sendMessage(chatId, CODE_PROMPT);
      return;
    }
    const keyboard = linkAccountKeyboard();
    if (this.deps.welcomeImagePath) {
      try {
        const image = await readFile(this.deps.welcomeImagePath);
        await this.deps.client.sendPhotoFile(
          chatId,
          new Uint8Array(image),
          WELCOME_CAPTION,
          keyboard,
        );
        return;
      } catch (error) {
        this.deps.warn(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Telegram welcome image could not be read.",
        );
      }
    }
    if (this.deps.welcomeImageUrl) {
      await this.deps.client.sendPhoto(
        chatId,
        this.deps.welcomeImageUrl,
        WELCOME_CAPTION,
        keyboard,
      );
      return;
    }
    await this.deps.client.sendMessage(chatId, WELCOME_CAPTION, keyboard);
  }

  private async sendError(chatId: number, error: unknown): Promise<void> {
    if (error instanceof AuthFlowError) {
      if (error.code === "email_already_linked") {
        await this.deps.client.sendMessage(chatId, EMAIL_ALREADY_LINKED);
        return;
      }
      if (error.code === "subscription_inactive") {
        await this.deps.client.sendMessage(chatId, INACTIVE);
        return;
      }
      if (error.code === "invalid_code") {
        await this.deps.client.sendMessage(chatId, `That code is invalid or expired.\n\n${CODE_PROMPT}`);
        return;
      }
      if (error.code === "verification_rate_limited") {
        await this.deps.client.sendMessage(
          chatId,
          "Too many verification attempts. Please wait a few minutes and try again.",
        );
        return;
      }
      if (error.code === "email_mismatch") {
        await this.deps.client.sendMessage(
          chatId,
          "This Telegram account is already linked to another subscription email.",
        );
        return;
      }
    }
    this.deps.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Subscription authentication failed.",
    );
    await this.deps.client.sendMessage(
      chatId,
      "Subscription verification is temporarily unavailable. Please try again shortly.",
    );
  }
}
