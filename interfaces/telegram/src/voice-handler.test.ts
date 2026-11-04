import { describe, expect, it, vi } from "vitest";
import type { BackendClient } from "./backend-client.js";
import type { TelegramClient } from "./client.js";
import { handleVoice } from "./voice-handler.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

function backend(overrides: Partial<BackendClient> = {}): BackendClient {
  return {
    chatVoice: async () => ({
      transcript: "What is my risk?",
      transcriptionModel: "test",
      text: "Keep risk consistent.",
      sources: [],
    }),
    synthesize: async () => ({
      audio: new Uint8Array([79, 103, 103, 83]),
      mimeType: "audio/ogg",
      model: "chatterbox-opus",
      voiceId: "Jason Sen 01",
      durationSeconds: 4,
    }),
    ...overrides,
  } as unknown as BackendClient;
}

describe("Telegram voice notes", () => {
  it("sends the mentor answer as Jason's voice", async () => {
    const client = {
      sendTyping: vi.fn(async () => {}),
      downloadFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      sendVoice: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
    } as unknown as TelegramClient;
    await handleVoice(
      { backend: backend(), client, warn: vi.fn() },
      10,
      20,
      identity,
      { file_id: "voice-file", duration: 4, mime_type: "audio/ogg" },
    );

    expect(client.sendVoice).toHaveBeenCalledWith(
      20,
      new Uint8Array([79, 103, 103, 83]),
      "audio/ogg",
      "Keep risk consistent.",
    );
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("falls back to the answer text when speech generation fails", async () => {
    const client = {
      sendTyping: vi.fn(async () => {}),
      downloadFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      sendVoice: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => {}),
    } as unknown as TelegramClient;
    const warn = vi.fn();
    await handleVoice(
      {
        backend: backend({
          synthesize: async () => {
            throw new Error("offline");
          },
        }),
        client,
        warn,
      },
      11,
      20,
      identity,
      { file_id: "voice-file", duration: 4, mime_type: "audio/ogg" },
    );

    expect(client.sendVoice).not.toHaveBeenCalled();
    expect(client.sendMessage).toHaveBeenCalledWith(
      20,
      expect.stringContaining("Keep risk consistent."),
    );
    expect(warn).toHaveBeenCalled();
  });
});
