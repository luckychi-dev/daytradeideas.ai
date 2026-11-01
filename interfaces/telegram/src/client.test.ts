import { afterEach, describe, expect, it, vi } from "vitest";
import { TelegramClient } from "./client.js";

afterEach(() => vi.unstubAllGlobals());

describe("TelegramClient media controls", () => {
  it("uploads the welcome image as multipart form data", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: {} }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TelegramClient("test-token");

    await client.sendPhotoFile(
      20,
      new Uint8Array([1, 2, 3]),
      "Welcome",
      { inline_keyboard: [[{ text: "Link my account", callback_data: "verify_subscription" }]] },
    );

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendPhoto");
    const form = request?.body as FormData;
    expect(form.get("chat_id")).toBe("20");
    expect(form.get("caption")).toBe("Welcome");
    expect((form.get("photo") as File).size).toBe(3);
  });

  it("removes the inline authentication button", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: true }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TelegramClient("test-token");

    await client.editMessageReplyMarkup(20, 30);

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"reply_markup":{"inline_keyboard":[]}',
    );
  });
});
