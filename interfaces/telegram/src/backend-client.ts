import {
  accessResponseSchema,
  authStatusSchema,
  chatResponseSchema,
  speechResponseSchema,
  supportResponseSchema,
  verifyResultSchema,
  voiceResponseSchema,
} from "./response-schemas.js";

export interface InterfaceIdentity {
  interfaceKind: "telegram";
  externalUserId: string;
  displayName?: string;
  username?: string;
}

export interface ChatSource {
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
}

export interface PlanLink {
  productId: number;
  name: string;
  price: number;
  currency: string;
  billingPeriod: string;
  billingInterval: number;
  purchaseUrl: string;
}

export interface ChatResponse {
  text: string;
  sources: ChatSource[];
}

export class SubscriberNotAllowedError extends Error {}
export class VoiceTranscriptionUnavailableError extends Error {}
export class VoiceOutputUnavailableError extends Error {}
export class BackendRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export class AuthFlowError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export type AuthState = "active" | "verification_required" | "awaiting_otp" | "inactive";

export class BackendClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly serviceToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async authorize(identity: InterfaceIdentity): Promise<boolean> {
    const response = await this.request("/v1/internal/access", { identity });
    if (response.status === 403) return false;
    if (!response.ok) throw new Error(`Backend access failed with status ${response.status}.`);
    return accessResponseSchema.parse(await response.json()).allowed;
  }

  async chat(input: {
    identity: InterfaceIdentity;
    text: string;
    requestId: string;
  }): Promise<ChatResponse> {
    const response = await this.request("/v1/internal/chat", input);
    if (response.status === 403) throw new SubscriberNotAllowedError();
    if (!response.ok) throw await this.toRequestError(response);
    return chatResponseSchema.parse(await response.json());
  }

  async supportChat(input: {
    identity: InterfaceIdentity;
    text: string;
    requestId: string;
  }): Promise<ChatResponse & { plans: PlanLink[] }> {
    const response = await this.request("/v1/internal/support-chat", input);
    if (!response.ok) throw await this.toRequestError(response);
    return supportResponseSchema.parse(await response.json());
  }

  async authStatus(identity: InterfaceIdentity): Promise<AuthState> {
    const response = await this.request("/v1/internal/auth/status", { identity });
    if (!response.ok) throw new Error(`Backend auth status failed with ${response.status}.`);
    return authStatusSchema.parse(await response.json()).state;
  }

  async requestCode(identity: InterfaceIdentity, email: string): Promise<void> {
    const response = await this.request("/v1/internal/auth/request-code", { identity, email });
    if (response.ok) return;
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new AuthFlowError(payload.error ?? "verification_unavailable");
  }

  async verifyCode(
    identity: InterfaceIdentity,
    code: string,
  ): Promise<{ verified: true; active: boolean }> {
    const response = await this.request("/v1/internal/auth/verify-code", { identity, code });
    if (response.ok) return verifyResultSchema.parse(await response.json());
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new AuthFlowError(payload.error ?? "verification_unavailable");
  }

  async unbind(identity: InterfaceIdentity): Promise<void> {
    const response = await this.request("/v1/internal/unbind", { identity });
    if (!response.ok) throw new Error(`Backend unbind failed with ${response.status}.`);
  }

  async chatVoice(input: {
    identity: InterfaceIdentity;
    requestId: string;
    audio: Uint8Array;
    mimeType: string;
    durationSeconds: number;
  }): Promise<ChatResponse & { transcript: string; transcriptionModel: string }> {
    const response = await this.request("/v1/internal/voice-chat", {
      identity: input.identity,
      requestId: input.requestId,
      audioBase64: Buffer.from(input.audio).toString("base64"),
      mimeType: input.mimeType,
      durationSeconds: input.durationSeconds,
    });
    if (response.status === 403) throw new SubscriberNotAllowedError();
    if (response.status === 503) throw new VoiceTranscriptionUnavailableError();
    if (!response.ok) throw await this.toRequestError(response);
    return voiceResponseSchema.parse(await response.json());
  }

  async synthesize(input: {
    identity: InterfaceIdentity;
    requestId: string;
    text: string;
  }): Promise<{
    audio: Uint8Array;
    mimeType: string;
    model: string;
    voiceId: string;
    durationSeconds: number;
  }> {
    const response = await this.request("/v1/internal/speech", input, 135_000);
    if (response.status === 403) throw new SubscriberNotAllowedError();
    if (response.status === 503) throw new VoiceOutputUnavailableError();
    if (!response.ok) throw await this.toRequestError(response);
    const speech = speechResponseSchema.parse(await response.json());
    return {
      ...speech,
      audio: new Uint8Array(Buffer.from(speech.audioBase64, "base64")),
    };
  }

  async chatImage(input: {
    identity: InterfaceIdentity;
    requestId: string;
    image: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
    text?: string;
  }): Promise<ChatResponse> {
    const response = await this.request("/v1/internal/image-chat", {
      identity: input.identity,
      requestId: input.requestId,
      imageBase64: Buffer.from(input.image).toString("base64"),
      mimeType: input.mimeType,
      ...(input.text ? { text: input.text } : {}),
    });
    if (response.status === 403) throw new SubscriberNotAllowedError();
    if (!response.ok) throw await this.toRequestError(response);
    return chatResponseSchema.parse(await response.json());
  }

  private async toRequestError(response: Response): Promise<BackendRequestError> {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    return new BackendRequestError(payload.error ?? `backend_${response.status}`);
  }

  private request(
    path: string,
    body: unknown,
    timeoutMs = 75_000,
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": this.serviceToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
}
