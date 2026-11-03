import {
  BackendRequestError,
  BackendClient,
  SubscriberNotAllowedError,
  type InterfaceIdentity,
} from "./backend-client.js";
import { TelegramClient } from "./client.js";
import { linkAccountKeyboard } from "./replies.js";
import type { messageSchema } from "./update-schema.js";
import type { z } from "zod";

type TelegramMessage = z.infer<typeof messageSchema>;

export interface TelegramImage {
  fileId: string;
  fileSize?: number;
  mimeType: "image/jpeg" | "image/png";
}

export interface ImageHandlerContext {
  backend: BackendClient;
  client: TelegramClient;
  warn(data: unknown, message?: string): void;
}

export function imageFromMessage(message: TelegramMessage): TelegramImage | null {
  const photo = message.photo?.at(-1);
  if (photo) {
    return {
      fileId: photo.file_id,
      ...(photo.file_size ? { fileSize: photo.file_size } : {}),
      mimeType: "image/jpeg",
    };
  }
  const document = message.document;
  if (!document) return null;
  const name = document.file_name?.toLowerCase() ?? "";
  const mimeType = document.mime_type === "image/png" || name.endsWith(".png")
    ? "image/png"
    : document.mime_type === "image/jpeg" || /\.jpe?g$/.test(name)
      ? "image/jpeg"
      : null;
  if (!mimeType) return null;
  return {
    fileId: document.file_id,
    ...(document.file_size ? { fileSize: document.file_size } : {}),
    mimeType,
  };
}

export async function handleImage(
  context: ImageHandlerContext,
  updateId: number,
  chatId: number,
  identity: InterfaceIdentity,
  image: TelegramImage,
  caption = "",
): Promise<void> {
  const maximumBytes = 6 * 1024 * 1024;
  if ((image.fileSize ?? 0) > maximumBytes) {
    await context.client.sendMessage(chatId, "That chart image is too large.");
    return;
  }
  await context.client.sendTyping(chatId);
  try {
    const bytes = await context.client.downloadFile(image.fileId);
    if (bytes.byteLength > maximumBytes) {
      await context.client.sendMessage(chatId, "That chart image is too large.");
      return;
    }
    const response = await context.backend.chatImage({
      identity,
      requestId: `telegram-image-${updateId}`,
      image: bytes,
      mimeType: image.mimeType,
      text: caption.trim() || "Review this uploaded trading chart.",
    });
    await context.client.sendMessage(chatId, response.text);
  } catch (error) {
    if (error instanceof SubscriberNotAllowedError) {
      await context.client.sendMessage(
        chatId,
        "Link your subscription before sending a chart for analysis.",
        linkAccountKeyboard(),
      );
      return;
    }
    if (error instanceof BackendRequestError) {
      const message = error.code === "vision_unavailable"
        ? "Chart reading is not configured yet. Please try again later."
        : error.code === "image_too_large"
          ? "That chart image is too large."
          : "I couldn't complete that chart request safely.";
      await context.client.sendMessage(chatId, message);
      return;
    }
    context.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram image request failed.",
    );
    await context.client.sendMessage(
      chatId,
      "I couldn't process that chart image safely. Please try again.",
    );
  }
}
