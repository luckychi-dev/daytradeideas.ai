import { describe, expect, it, vi } from "vitest";
import { handleAccountCommand } from "./account-command-handler.js";
import type { BackendClient } from "./backend-client.js";
import type { TelegramClient } from "./client.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

describe("Telegram account commands", () => {
  it("unbinds the current account and offers verification", async () => {
    const backend = { unbind: vi.fn(async () => {}) } as unknown as BackendClient;
    const client = { sendMessage: vi.fn(async () => {}) } as unknown as TelegramClient;

    await handleAccountCommand(
      { backend, client, warn: vi.fn() },
      10,
      20,
      identity,
      "/unbind",
    );

    expect(backend.unbind).toHaveBeenCalledWith(identity);
    expect(client.sendMessage).toHaveBeenCalledWith(
      20,
      expect.stringContaining("has been unlinked"),
      {
        inline_keyboard: [[{
          text: "Link my account",
          callback_data: "verify_subscription",
        }]],
      },
    );
  });
});
