import { describe, expect, it, vi } from "vitest";
import type { BackendClient } from "./backend-client.js";
import type { TelegramClient } from "./client.js";
import { handlePublicSupport } from "./support-handler.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

describe("Telegram public support", () => {
  it("returns plan links as inline URL buttons", async () => {
    const backend = {
      supportChat: vi.fn(async () => ({
        text: "Here are the available plans.",
        sources: [],
        plans: [{
          productId: 550,
          name: "Index signals",
          price: 79,
          currency: "GBP",
          billingPeriod: "month",
          billingInterval: 1,
          purchaseUrl: "https://example.com/index-plan",
        }],
      })),
    } as unknown as BackendClient;
    const client = {
      sendTyping: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
    } as unknown as TelegramClient;

    await handlePublicSupport(
      { backend, client, warn: vi.fn() },
      10,
      20,
      identity,
      "What plans do you offer?",
    );

    expect(backend.supportChat).toHaveBeenCalledWith({
      identity,
      text: "What plans do you offer?",
      requestId: "telegram-support-10",
    });
    expect(client.sendMessage).toHaveBeenCalledWith(
      20,
      "Here are the available plans.\n\nAlready subscribed? Link your account to continue.",
      {
        inline_keyboard: [
          [{
            text: "Index signals",
            url: "https://example.com/index-plan",
          }],
          [{
            text: "Link my account",
            callback_data: "verify_subscription",
          }],
        ],
      },
    );
  });
});
