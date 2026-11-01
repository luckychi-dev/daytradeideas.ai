import { z } from "zod";
import type { VisionProvider } from "../../domain/ports.js";
import type { VisionRequest, VisionResult } from "../../domain/types.js";

export class VisionUnavailableError extends Error {}

const responseSchema = z.object({
  model: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })).optional(),
  })),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

export interface XaiVisionOptions {
  apiKey?: string;
  baseURL: string;
  model: string;
}

export class XaiVisionProvider implements VisionProvider {
  constructor(private readonly options: XaiVisionOptions) {}

  async analyze(request: VisionRequest): Promise<VisionResult> {
    if (!this.options.apiKey) throw new VisionUnavailableError();
    const imageUrl =
      `data:${request.mimeType};base64,` +
      Buffer.from(request.image).toString("base64");
    const response = await fetch(
      `${this.options.baseURL.replace(/\/+$/, "")}/responses`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          input: [{
            role: "user",
            content: [
              { type: "input_image", image_url: imageUrl, detail: "high" },
              { type: "input_text", text: request.prompt },
            ],
          }],
          max_output_tokens: request.maxOutputTokens,
          store: false,
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Vision provider failed with status ${response.status}.`);
    }
    const result = responseSchema.parse(await response.json());
    const text = result.output
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Vision provider returned no observation.");
    return {
      text,
      model: result.model ?? this.options.model,
      inputTokens: result.usage?.input_tokens ?? 0,
      outputTokens: result.usage?.output_tokens ?? 0,
    };
  }
}
