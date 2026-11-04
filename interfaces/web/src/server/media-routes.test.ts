import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { WebBackendPort } from "./backend-client.js";
import { registerWebRoutes } from "./routes.js";
import type { WebSpeechPort } from "./speech-backend-client.js";
import { successfulSpeech } from "./speech-test-fixture.js";

const sessionSecret = "s".repeat(32);

function backend(overrides: Partial<WebBackendPort> = {}): WebBackendPort {
  return {
    authStatus: async () => "active",
    requestCode: async () => {},
    verifyCode: async () => ({ verified: true, active: true }),
    claimAccount: async () => ({ verified: true, active: true }),
    unbind: async () => {},
    chat: async () => ({ text: "answer", sources: [] }),
    chatVoice: async () => ({
      text: "voice answer",
      transcript: "voice question",
      transcriptionModel: "test",
      sources: [],
    }),
    chatImage: async () => ({ text: "chart answer", sources: [] }),
    supportChat: async () => ({ text: "support", sources: [], plans: [] }),
    ...overrides,
  };
}

async function setup(
  port: WebBackendPort,
  speech: WebSpeechPort = successfulSpeech,
) {
  const app = Fastify();
  await app.register(registerWebRoutes, {
    backend: port,
    sessionSecret,
    secureCookie: false,
    telegramBotUrl: "https://t.me/jasonsenaibot",
    authLimiter: { consume: () => ({ allowed: true, retryAfterSeconds: 0 }) },
    speech,
  });
  const session = await app.inject({ method: "GET", url: "/api/session" });
  return {
    app,
    cookie: String(session.headers["set-cookie"]).split(";")[0] ?? "",
  };
}

describe("web media routes", () => {
  it("forwards a chart for an active signed-in subscriber", async () => {
    const chatImage = vi.fn<WebBackendPort["chatImage"]>(async () => ({
      text: "chart answer",
      sources: [],
    }));
    const { app, cookie } = await setup(backend({ chatImage }));
    const response = await app.inject({
      method: "POST",
      url: "/api/image-chat",
      headers: { cookie },
      payload: {
        imageBase64: Buffer.from("chart").toString("base64"),
        mimeType: "image/png",
        text: "Review this chart",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(chatImage).toHaveBeenCalledWith(
      expect.objectContaining({ interfaceKind: "web" }),
      expect.objectContaining({ mimeType: "image/png", text: "Review this chart" }),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await app.close();
  });

  it("accepts browser WebM voice notes for an active subscriber", async () => {
    const chatVoice = vi.fn<WebBackendPort["chatVoice"]>(async () => ({
      text: "voice answer",
      transcript: "voice question",
      transcriptionModel: "test",
      sources: [],
    }));
    const synthesize = vi.fn<WebSpeechPort["synthesize"]>(async () => ({
      audioBase64: "T2dnUw==",
      mimeType: "audio/ogg",
      model: "chatterbox-opus",
      voiceId: "Jason Sen 01",
      durationSeconds: 3,
    }));
    const { app, cookie } = await setup(
      backend({ chatVoice }),
      { synthesize },
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/voice-chat",
      headers: { cookie },
      payload: {
        audioBase64: Buffer.from("audio").toString("base64"),
        mimeType: "audio/webm",
        durationSeconds: 3,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      voiceNote: { mimeType: "audio/ogg", voiceId: "Jason Sen 01" },
    });
    expect(chatVoice).toHaveBeenCalledWith(
      expect.anything(),
      Buffer.from("audio").toString("base64"),
      "audio/webm",
      3,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ interfaceKind: "web" }),
      "voice answer",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await app.close();
  });
});
