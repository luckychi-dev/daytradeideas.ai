import { z } from "zod";
import type { TranscriptionProvider } from "../../domain/ports.js";
import type { TranscriptionResult } from "../../domain/types.js";
import { TranscriptionUnavailableError } from "./openai-transcription.js";
import { NoSpeechDetectedError } from "./transcription-errors.js";

const responseSchema = z.object({ text: z.string() });

export interface XaiTranscriptionOptions {
  apiKey?: string;
  baseURL: string;
  model: string;
}

function audioExtension(mimeType: string): string {
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/mp4" || mimeType === "audio/m4a") return "m4a";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/opus") return "opus";
  return "ogg";
}

export class XaiTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly options: XaiTranscriptionOptions) {}

  async transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult> {
    if (!this.options.apiKey) throw new TranscriptionUnavailableError();
    const form = new FormData();
    form.append("model", this.options.model);
    form.append("format", "true");
    form.append("language", "en");
    for (const term of [
      "Day Trade Ideas",
      "Jason Sen",
      "Fibonacci",
      "confluence",
      "reward-to-risk",
      "stop-loss",
      "EURUSD",
      "XAUUSD",
      "Nasdaq",
      "WTI",
    ]) {
      form.append("keyterm", term);
    }
    const extension = audioExtension(mimeType);
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${extension}`);
    const response = await fetch(
      `${this.options.baseURL.replace(/\/+$/, "")}/stt`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${this.options.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) {
      throw new Error(`xAI transcription failed with status ${response.status}.`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    const text = parsed.success ? parsed.data.text.trim() : "";
    if (!text) throw new NoSpeechDetectedError();
    return { text, model: this.options.model };
  }
}
