import { z } from "zod";
import type { TranscriptionProvider } from "../../domain/ports.js";
import type { TranscriptionResult } from "../../domain/types.js";
import {
  NoSpeechDetectedError,
  TranscriptionUnavailableError,
} from "./transcription-errors.js";

export { TranscriptionUnavailableError } from "./transcription-errors.js";

export interface OpenAITranscriptionOptions {
  apiKey?: string;
  baseURL: string;
  model: string;
}

const responseSchema = z.object({ text: z.string() });

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly options: OpenAITranscriptionOptions) {}

  async transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult> {
    if (!this.options.apiKey) throw new TranscriptionUnavailableError();
    const extension = mimeType === "audio/mpeg"
      ? "mp3"
      : mimeType === "audio/mp4" || mimeType === "audio/m4a"
        ? "m4a"
        : mimeType === "audio/wav" || mimeType === "audio/x-wav"
          ? "wav"
          : mimeType === "audio/webm"
            ? "webm"
            : "ogg";
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${extension}`);
    form.append("model", this.options.model);
    form.append(
      "prompt",
      "Day Trade Ideas trading mentor. Terms may include Fibonacci, confluence, " +
      "reward-to-risk, stop-loss, EURUSD, XAUUSD, Nasdaq and WTI.",
    );
    const response = await fetch(
      `${this.options.baseURL.replace(/\/+$/, "")}/audio/transcriptions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${this.options.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Transcription provider failed with status ${response.status}.`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    const text = parsed.success ? parsed.data.text.trim() : "";
    if (!text) throw new NoSpeechDetectedError();
    return { text, model: this.options.model };
  }
}
