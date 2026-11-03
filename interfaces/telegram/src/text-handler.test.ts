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
});
