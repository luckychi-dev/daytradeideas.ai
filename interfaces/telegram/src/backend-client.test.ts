import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BackendClient,
  SubscriberNotAllowedError,
} from "./backend-client.js";

const identity = { interfaceKind: "telegram" as const, externalUserId: "123" };

afterEach(() => vi.unstubAllGlobals());

describe("BackendClient", () => {
  it("uses the shared service token for backend calls", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ allowed: true, subscriberId: "subscriber-a" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://backend:3000", "a".repeat(32));

    await expect(client.authorize(identity)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:3000/v1/internal/access",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-service-token": "a".repeat(32) }),
      }),
    );
  });

  it("maps a backend 403 to an unauthorised subscriber", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const client = new BackendClient("http://backend:3000", "a".repeat(32));
    await expect(client.chat({
      identity,
      text: "question",
      requestId: "update-1",
    })).rejects.toBeInstanceOf(SubscriberNotAllowedError);
  });

  it("uploads voice bytes and returns the transcript and answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({
        transcript: "What is my risk?",
        transcriptionModel: "test-transcribe",
        text: "Keep risk consistent.",
        sources: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    const client = new BackendClient("http://backend:3000", "a".repeat(32));
    await expect(client.chatVoice({
      identity,
      requestId: "voice-1",
      audio: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
      durationSeconds: 5,
    })).resolves.toMatchObject({
      transcript: "What is my risk?",
      text: "Keep risk consistent.",
    });
  });

  it("requests Chatterbox audio for the mentor answer", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        audioBase64: "T2dnUw==",
        mimeType: "audio/ogg",
        model: "chatterbox-opus",
        voiceId: "Jason Sen 01",
        durationSeconds: 4,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://backend:3000", "a".repeat(32));

    await expect(client.synthesize({
      identity,
      requestId: "voice-1-speech",
      text: "Keep risk consistent.",
    })).resolves.toMatchObject({
      audio: new Uint8Array([79, 103, 103, 83]),
      mimeType: "audio/ogg",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"text":"Keep risk consistent."');
  });

  it("uploads chart bytes to the image-aware mentor endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ text: "Chart answer", sources: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://backend:3000", "a".repeat(32));

    await expect(client.chatImage({
      identity,
      requestId: "image-1",
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      text: "Review this chart",
    })).resolves.toMatchObject({ text: "Chart answer" });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"imageBase64":"AQID"');
  });

  it("returns verification state and maps auth errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ state: "awaiting_otp" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: "subscription_inactive" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new BackendClient("http://backend:3000", "a".repeat(32));
    await expect(client.authStatus(identity)).resolves.toBe("awaiting_otp");
    await expect(client.verifyCode(identity, "123456"))
      .rejects.toEqual(expect.objectContaining({
        code: "subscription_inactive",
      }));
  });
});
