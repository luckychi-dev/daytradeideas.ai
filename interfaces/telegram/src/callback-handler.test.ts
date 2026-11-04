import { describe, expect, it, vi } from "vitest";
import type { TelegramAuthHandler } from "./auth-handler.js";
import type { BackendClient } from "./backend-client.js";
import { handleCallback } from "./callback-handler.js";
import type { TelegramClient } from "./client.js";

const callback = {
  id: "callback-1",
  from: { id: 123, is_bot: false, first_name: "Member" },
  message: {
    message_id: 30,
    chat: { id: 123, type: "private" },
    date: 1,
  },
  data: "claim_subscription",
};

describe("Telegram auth callbacks", () => {
  it("claims the account when Use Here Instead is selected", async () => {
    const client = {} as TelegramClient;
    const backend = {} as BackendClient;
    const auth = { handleTakeover: vi.fn(async () => {}) } as unknown as TelegramAuthHandler;

    await handleCallback({ backend, client, auth, serviceUnavailable: vi.fn() }, callback);

    expect(auth.handleTakeover).toHaveBeenCalledWith(
      "callback-1",
      123,
      30,
      expect.objectContaining({ interfaceKind: "telegram", externalUserId: "123" }),
    );
  });
});
