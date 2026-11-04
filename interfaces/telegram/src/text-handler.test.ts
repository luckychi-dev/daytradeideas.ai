import { describe, expect, it, vi } from "vitest";
import { handleText, type TextHandlerContext } from "./text-handler.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

describe("Telegram text handling", () => {
  it("sends the mentor answer without exposing source footers", async () => {
    const client = {
      sendTyping: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
    };
    const backend = {
      chat: vi.fn(async () => ({
        text: "Here is how I approach it.",
        sources: [{
          sourceId: "source-a",
          sourceTitle: "Internal source title",
          sourceVersion: "1.0",
          locator: "paragraph 1",
        }],
      })),
    };

    await handleText(
      { client, backend, warn: vi.fn() } as unknown as TextHandlerContext,
      1,
      10,
      identity,
      "How should I trade the news?",
    );

    expect(client.sendMessage).toHaveBeenCalledWith(10, "Here is how I approach it.");
  });

  it("sends a spoken reply when the subscriber explicitly asks for voice", async () => {
    const client = {
      sendTyping: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
      sendVoice: vi.fn(async () => {}),
    };
    const backend = {
      chat: vi.fn(async () => ({
        text: "Of course. What would you like me to work through?",
        sources: [],
      })),
      synthesize: vi.fn(async () => ({
        audio: new Uint8Array([79, 103, 103, 83]),
        mimeType: "audio/ogg",
        model: "chatterbox-opus",
        voiceId: "Jason Sen 01",
        durationSeconds: 4,
      })),
    };

    await handleText(
      { client, backend, warn: vi.fn() } as unknown as TextHandlerContext,
      2,
      10,
      identity,
      "Hi, can you send me a voice message?",
    );

    expect(backend.synthesize).toHaveBeenCalledWith({
      identity,
      requestId: "telegram-2-speech",
      text: "Of course. What would you like me to work through?",
    });
    expect(client.sendVoice).toHaveBeenCalledWith(
      10,
      new Uint8Array([79, 103, 103, 83]),
      "audio/ogg",
    );
    expect(client.sendMessage).not.toHaveBeenCalled();
  });
});
