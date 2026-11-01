import { describe, expect, it, vi } from "vitest";
import { handleImage, imageFromMessage, type ImageHandlerContext } from "./image-handler.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

describe("Telegram image handling", () => {
  it("uses the largest Telegram photo", () => {
    const image = imageFromMessage({
      message_id: 1,
      chat: { id: 10, type: "private" },
      date: 1,
      caption: "Review this",
      photo: [
        { file_id: "small", file_unique_id: "a", width: 100, height: 80 },
        { file_id: "large", file_unique_id: "b", width: 1200, height: 900, file_size: 4000 },
      ],
    });

    expect(image).toEqual({
      fileId: "large",
      fileSize: 4000,
      mimeType: "image/jpeg",
    });
  });

  it("downloads the chart and sends it through the mentor contract", async () => {
    const client = {
      sendTyping: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
      downloadFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
    };
    const backend = {
      chatImage: vi.fn(async () => ({
        text: "The trend is clearly visible.",
        sources: [],
      })),
    };
    await handleImage(
      { client, backend, warn: vi.fn() } as unknown as ImageHandlerContext,
      77,
      10,
      identity,
      { fileId: "chart", mimeType: "image/png" },
      "What is visible?",
    );

    expect(backend.chatImage).toHaveBeenCalledWith({
      identity,
      requestId: "telegram-image-77",
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      text: "What is visible?",
    });
    expect(client.sendMessage).toHaveBeenCalledWith(
      10,
      "The trend is clearly visible.",
    );
  });
});
