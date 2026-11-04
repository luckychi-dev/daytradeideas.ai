import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptionUnavailableError } from "./openai-transcription.js";
import { XaiTranscriptionProvider } from "./xai-transcription.js";
import { NoSpeechDetectedError } from "./transcription-errors.js";

afterEach(() => vi.unstubAllGlobals());

const options = {
  baseURL: "https://api.x.ai/v1",
  model: "grok-voice-transcribe-2.0",
};

describe("XaiTranscriptionProvider", () => {
  it("requires an API key", async () => {
    const provider = new XaiTranscriptionProvider(options);
    await expect(provider.transcribe(new Uint8Array([1]), "audio/ogg"))
      .rejects.toBeInstanceOf(TranscriptionUnavailableError);
  });

  it("sends Telegram audio to the xAI STT endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ text: "Assess this setup." }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new XaiTranscriptionProvider({ ...options, apiKey: "xai-test" });
    await expect(provider.transcribe(new Uint8Array([1, 2]), "audio/ogg"))
      .resolves.toEqual({ text: "Assess this setup.", model: options.model });
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.x.ai/v1/stt");
    expect(request).toMatchObject({
      headers: { authorization: "Bearer xai-test" },
    });
    expect((request?.body as FormData).get("model")).toBe(options.model);
    expect(((request?.body as FormData).get("file") as File).name).toBe("voice.ogg");
  });

  it("preserves the audio container extension for non-Telegram interfaces", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ text: "Assess this setup." }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new XaiTranscriptionProvider({ ...options, apiKey: "xai-test" });

    await provider.transcribe(new Uint8Array([1, 2]), "audio/wav");

    const request = fetchMock.mock.calls[0]?.[1];
    expect(((request?.body as FormData).get("file") as File).name).toBe("voice.wav");
  });

  it("reports silence instead of validating an empty transcript", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ text: "   " }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    const provider = new XaiTranscriptionProvider({ ...options, apiKey: "xai-test" });

    await expect(provider.transcribe(new Uint8Array([1]), "audio/ogg"))
      .rejects.toBeInstanceOf(NoSpeechDetectedError);
  });
});
