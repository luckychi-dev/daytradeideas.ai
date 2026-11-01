import { describe, expect, it, vi } from "vitest";
import { TelegramAuthHandler } from "./auth-handler.js";
import type { BackendClient } from "./backend-client.js";
import type { TelegramClient } from "./client.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

function setup() {
  const backend = {
    requestCode: vi.fn(async () => {}),
    verifyCode: vi.fn(async () => ({ verified: true, active: true })),
    supportChat: vi.fn(async () => ({ text: "Plans", sources: [], plans: [] })),
  } as unknown as BackendClient;
  const client = {
    sendTyping: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    sendPhoto: vi.fn(async () => {}),
    sendPhotoFile: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    editMessageReplyMarkup: vi.fn(async () => {}),
  } as unknown as TelegramClient;
  return {
    backend,
    client,
    handler: new TelegramAuthHandler({ backend, client, warn: vi.fn() }),
  };
}

describe("TelegramAuthHandler", () => {
  it("shows a welcome message with a verification button", async () => {
    const { client, handler } = setup();
    await handler.handle(10, identity, "verification_required", "/start");
    expect(client.sendMessage).toHaveBeenCalledWith(
      10,
      expect.stringContaining("Welcome to Jason Sen AI Mentor"),
      expect.objectContaining({
        inline_keyboard: [[{
          text: "Link my account",
          callback_data: "verify_subscription",
        }]],
      }),
    );
  });

  it("sends the configured welcome image", async () => {
    const backend = {} as BackendClient;
    const client = {
      sendPhoto: vi.fn(async () => {}),
    } as unknown as TelegramClient;
    const handler = new TelegramAuthHandler({
      backend,
      client,
      welcomeImageUrl: "https://example.com/welcome.png",
      warn: vi.fn(),
    });
    await handler.handle(10, identity, "verification_required", "/start");
    expect(client.sendPhoto).toHaveBeenCalledWith(
      10,
      "https://example.com/welcome.png",
      expect.stringContaining("24/7 AI assistant"),
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
  });

  it("opens the email form after the button callback", async () => {
    const { client, handler } = setup();
    await handler.handleButton("callback-1", 10, 25, identity, "verification_required");
    expect(client.answerCallbackQuery).toHaveBeenCalledWith("callback-1");
    expect(client.editMessageReplyMarkup).toHaveBeenCalledWith(10, 25);
    expect(client.sendMessage).toHaveBeenCalledWith(
      10,
      expect.stringContaining("Send the email address"),
    );
  });

  it("requests and verifies an OTP", async () => {
    const { backend, client, handler } = setup();
    await handler.handle(10, identity, "verification_required", "member@example.com");
    expect(backend.requestCode).toHaveBeenCalledWith(identity, "member@example.com");
    await handler.handle(10, identity, "awaiting_otp", "123456");
    expect(backend.verifyCode).toHaveBeenCalledWith(identity, "123456");
    expect(client.sendMessage).toHaveBeenCalledWith(
      10,
      "✅ Account linked. You're ready to chat.",
    );
  });

  it("leaves ordinary unauthenticated questions for public support", async () => {
    const { client, handler } = setup();
    await expect(
      handler.handle(10, identity, "verification_required", "What plans do you offer?"),
    ).resolves.toBe(false);
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("verifies an email without a subscription and resends plan support", async () => {
    const { backend, client, handler } = setup();
    vi.mocked(backend.verifyCode).mockResolvedValueOnce({ verified: true, active: false });
    await handler.handle(10, identity, "awaiting_otp", "123456");

    expect(client.sendMessage).toHaveBeenCalledWith(
      10,
      expect.stringContaining("No active membership"),
    );
    expect(backend.supportChat).toHaveBeenCalled();
  });
});
