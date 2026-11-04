interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TelegramFile {
  file_id: string;
  file_path?: string;
  file_size?: number;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
}

function splitAtBoundary(text: string, maximum: number): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maximum) {
    const candidate = remaining.slice(0, maximum);
    const boundary = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
    const cut = boundary > maximum / 2 ? boundary : maximum;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export class TelegramClient {
  private readonly baseUrl: string;
  private readonly fileBaseUrl: string;

  constructor(private readonly botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.fileBaseUrl = `https://api.telegram.org/file/bot${botToken}`;
  }

  async sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<void> {
    const chunks = splitAtBoundary(text, 4000);
    for (const [index, chunk] of chunks.entries()) {
      await this.request("sendMessage", {
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
        ...(replyMarkup && index === chunks.length - 1
          ? { reply_markup: replyMarkup }
          : {}),
      });
    }
  }

  async sendPhoto(
    chatId: number,
    photoUrl: string,
    caption: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<void> {
    await this.request("sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption.slice(0, 1024),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  async sendPhotoFile(
    chatId: number,
    photo: Uint8Array,
    caption: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<void> {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption.slice(0, 1024));
    if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
    form.append(
      "photo",
      new Blob([new Uint8Array(photo)], { type: "image/png" }),
      "telegram-welcome.png",
    );
    const response = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json()) as TelegramResponse<unknown>;
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram sendPhoto failed with status ${response.status}.`);
    }
  }

  async sendVoice(
    chatId: number,
    audio: Uint8Array,
    mimeType = "audio/ogg",
  ): Promise<void> {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(
      "voice",
      new Blob([new Uint8Array(audio)], { type: mimeType }),
      "mentor-reply.ogg",
    );
    const response = await fetch(`${this.baseUrl}/sendVoice`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json()) as TelegramResponse<unknown>;
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram sendVoice failed with status ${response.status}.`);
    }
  }

  async editMessageReplyMarkup(chatId: number, messageId: number): Promise<void> {
    await this.request("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  async sendTyping(chatId: number): Promise<void> {
    await this.request("sendChatAction", { chat_id: chatId, action: "typing" });
  }

  async setWebhook(url: string, secretToken: string): Promise<void> {
    await this.request("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async getUpdates(offset: number | undefined): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/getUpdates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(offset !== undefined ? { offset } : {}),
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      }),
      signal: AbortSignal.timeout(35_000),
    });
    const payload = (await response.json()) as TelegramResponse<unknown[]>;
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram getUpdates failed with status ${response.status}.`);
    }
    return payload.result ?? [];
  }

  async downloadFile(fileId: string): Promise<Uint8Array> {
    const file = await this.request<TelegramFile>("getFile", { file_id: fileId });
    if (!file.file_path) throw new Error("Telegram did not provide a file path.");
    const response = await fetch(`${this.fileBaseUrl}/${file.file_path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Telegram file download failed with ${response.status}.`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async request<T = unknown>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as TelegramResponse<T>;
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram ${method} failed with status ${response.status}.`);
    }
    return payload.result as T;
  }
}

export { splitAtBoundary };
