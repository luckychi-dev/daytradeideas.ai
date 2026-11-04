import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAITranscriptionProvider,
  TranscriptionUnavailableError,
} from "./openai-transcription.js";
import { NoSpeechDetectedError } from "./transcription-errors.js";

afterEach(() => vi.unstubAllGlobals());

const options = {
  baseURL: "https://api.openai.test/v1",
  model: "gpt-4o-mini-transcribe",
};

describe("OpenAITranscriptionProvider", () => {
  it("requires an API key before making a request", async () => {
    const provider = new OpenAITranscriptionProvider(options);
    await expect(provider.transcribe(new Uint8Array([1]), "audio/ogg"))
      .rejects.toBeInstanceOf(TranscriptionUnavailableError);
  });

  it("sends the voice note to the transcription endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ text: "Assess my trade." }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAITranscriptionProvider({ ...options, apiKey: "test-key" });

    await expect(provider.transcribe(new Uint8Array([1, 2, 3]), "audio/ogg"))
      .resolves.toEqual({ text: "Assess my trade.", model: options.model });

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.test/v1/audio/transcriptions");
    expect(request).toMatchObject({
      method: "POST",
      headers: { authorization: "Bearer test-key" },
    });
    expect((request?.body as FormData).get("model")).toBe(options.model);
  });

  it("rejects an empty transcript with a no-speech error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ text: "" }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    const provider = new OpenAITranscriptionProvider({ ...options, apiKey: "test-key" });

    await expect(provider.transcribe(new Uint8Array([1]), "audio/ogg"))
      .rejects.toBeInstanceOf(NoSpeechDetectedError);
  });
});
