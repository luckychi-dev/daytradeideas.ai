import { BackendApiError, type WebIdentity } from "./backend-client.js";

export interface WebVoiceNote {
  audioBase64: string;
  mimeType: "audio/ogg" | "audio/opus" | "audio/wav";
  model: string;
  voiceId: string;
  durationSeconds: number;
}

export interface WebSpeechPort {
  synthesize(
    identity: WebIdentity,
    text: string,
    requestId: string,
  ): Promise<WebVoiceNote>;
}

export class BackendSpeechClient implements WebSpeechPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly serviceToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async synthesize(
    identity: WebIdentity,
    text: string,
    requestId: string,
  ): Promise<WebVoiceNote> {
    const response = await fetch(`${this.baseUrl}/v1/internal/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": this.serviceToken,
      },
      body: JSON.stringify({ identity, text, requestId }),
      signal: AbortSignal.timeout(135_000),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new BackendApiError(
        response.status,
        payload.error ?? `backend_${response.status}`,
      );
    }
    return await response.json() as WebVoiceNote;
  }
}
