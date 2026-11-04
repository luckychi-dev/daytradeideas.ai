import { z } from "zod";
import type { SpeechProvider } from "../../domain/ports.js";
import type { SpeechResult } from "../../domain/types.js";
import { ChatterboxAuth } from "./chatterbox-auth.js";
import { SpeechGenerationError, SpeechUnavailableError } from "./speech-errors.js";

export interface ChatterboxSpeechOptions {
  baseURL: string;
  passcode?: string;
  sessionCookie?: string;
  voiceMode: "clone" | "predefined";
  voiceId: string;
  timeoutMs: number;
}

const referenceVoiceSchema = z.object({
  filename: z.string().min(1),
  name: z.string().min(1),
});

function speechText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export class ChatterboxSpeechProvider implements SpeechProvider {
  private readonly auth: ChatterboxAuth;
  private readonly baseURL: string;
  private resolvedVoiceId: string | undefined;

  constructor(private readonly options: ChatterboxSpeechOptions) {
    this.baseURL = options.baseURL.replace(/\/+$/, "");
    this.auth = new ChatterboxAuth({
      baseURL: this.baseURL,
      ...(options.passcode ? { passcode: options.passcode } : {}),
      ...(options.sessionCookie ? { sessionCookie: options.sessionCookie } : {}),
      timeoutMs: options.timeoutMs,
    });
  }

  async synthesize(text: string): Promise<SpeechResult> {
    const script = speechText(text);
    if (!script) throw new SpeechGenerationError();
    let cookie = await this.auth.cookie();
    let voiceId = await this.resolveVoiceId(cookie);
    let response = await this.generate(script, cookie, voiceId);
    if (response.status === 401 || response.status === 403) {
      cookie = await this.auth.cookie(true);
      this.resolvedVoiceId = undefined;
      voiceId = await this.resolveVoiceId(cookie);
      response = await this.generate(script, cookie, voiceId);
    }
    if (!response.ok) throw new SpeechGenerationError();
    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.byteLength === 0) throw new SpeechGenerationError();
    return {
      audio,
      mimeType: "audio/ogg",
      model: "chatterbox-opus",
      voiceId: this.options.voiceId,
    };
  }

  private async resolveVoiceId(cookie: string): Promise<string> {
    if (this.options.voiceMode !== "clone" || this.resolvedVoiceId) {
      return this.resolvedVoiceId ?? this.options.voiceId;
    }
    const response = await fetch(
      `${this.baseURL}/get_reference_voice_records`,
      { headers: { cookie }, signal: AbortSignal.timeout(15_000) },
    ).catch(() => undefined);
    const parsed = response?.ok
      ? z.array(referenceVoiceSchema).safeParse(await response.json().catch(() => null))
      : null;
    const match = parsed?.success
      ? parsed.data.find((voice) =>
          voice.name === this.options.voiceId || voice.filename === this.options.voiceId)
      : undefined;
    this.resolvedVoiceId = match?.filename ?? this.options.voiceId;
    return this.resolvedVoiceId;
  }

  private generate(
    script: string,
    cookie: string,
    voiceId: string,
  ): Promise<Response> {
    return fetch(`${this.baseURL}/tts`, {
      method: "POST",
      headers: {
        accept: "audio/opus",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        text: script,
        voice_mode: this.options.voiceMode,
        ...(this.options.voiceMode === "clone"
          ? { reference_audio_filename: voiceId }
          : { predefined_voice_id: voiceId }),
        output_format: "opus",
        split_text: true,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    }).catch(() => {
      throw new SpeechUnavailableError();
    });
  }
}
