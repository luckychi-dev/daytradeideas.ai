import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatterboxSpeechProvider } from "./chatterbox-speech.js";
import { SpeechUnavailableError } from "./speech-errors.js";

afterEach(() => vi.unstubAllGlobals());

const options = {
  baseURL: "https://voiceclone.example",
  passcode: "1234",
  voiceMode: "clone" as const,
  voiceId: "Jason Sen 01",
  timeoutMs: 5_000,
};

describe("ChatterboxSpeechProvider", () => {
  it("authenticates and requests the configured Jason clone as Opus", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 303,
        headers: { "set-cookie": "voice_session=token; Path=/; HttpOnly" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        filename: "recording-123.wav",
        name: "Jason Sen 01",
      }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([79, 103, 103, 83]), {
        status: 200,
        headers: { "content-type": "audio/opus" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ChatterboxSpeechProvider(options);

    await expect(provider.synthesize("Use **defined risk**.")).resolves.toEqual({
      audio: new Uint8Array([79, 103, 103, 83]),
      mimeType: "audio/ogg",
      model: "chatterbox-opus",
      voiceId: "Jason Sen 01",
    });

    const login = fetchMock.mock.calls[0]?.[1];
    expect(String(login?.body)).toBe("passcode=1234");
    const voices = fetchMock.mock.calls[1]?.[1];
    expect(voices?.headers).toMatchObject({ cookie: "voice_session=token" });
    const speech = fetchMock.mock.calls[2]?.[1];
    expect(speech?.headers).toMatchObject({
      accept: "audio/opus",
      cookie: "voice_session=token",
    });
    expect(JSON.parse(String(speech?.body))).toMatchObject({
      text: "Use defined risk.",
      voice_mode: "clone",
      reference_audio_filename: "recording-123.wav",
      output_format: "opus",
      split_text: true,
    });
  });

  it("requires a passcode or existing session cookie", async () => {
    const provider = new ChatterboxSpeechProvider({
      ...options,
      passcode: undefined,
    });
    await expect(provider.synthesize("Hello")).rejects
      .toBeInstanceOf(SpeechUnavailableError);
  });
});
