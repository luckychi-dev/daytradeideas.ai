import { afterEach, describe, expect, it, vi } from "vitest";
import { VisionUnavailableError } from "./xai-vision.js";
import { XaiVisionProvider } from "./xai-vision.js";

const request = {
  image: new Uint8Array([1, 2, 3]),
  mimeType: "image/png" as const,
  prompt: "Describe the visible chart evidence.",
  maxOutputTokens: 800,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("XaiVisionProvider", () => {
  it("fails cleanly when the vision provider is not configured", async () => {
    const provider = new XaiVisionProvider({
      baseURL: "https://api.x.ai/v1",
      model: "grok-4.7",
    });
    await expect(provider.analyze(request)).rejects.toBeInstanceOf(
      VisionUnavailableError,
    );
  });

  it("sends a high-detail image without server-side history", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      model: "grok-4.7",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "A daily gold chart with visible resistance.",
        }],
      }],
      usage: { input_tokens: 120, output_tokens: 18 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new XaiVisionProvider({
      apiKey: "test-key",
      baseURL: "https://api.x.ai/v1",
      model: "grok-4.7",
    });

    const result = await provider.analyze(request);

    expect(result).toEqual({
      text: "A daily gold chart with visible resistance.",
      model: "grok-4.7",
      inputTokens: 120,
      outputTokens: 18,
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.store).toBe(false);
    expect(body.input[0].content[0]).toMatchObject({
      type: "input_image",
      detail: "high",
    });
  });
});
