import {
  authStatusSchema,
  chatSchema,
  supportSchema,
  verifySchema,
  voiceSchema,
} from "./backend-schemas.js";

export type AuthState = "active" | "verification_required" | "awaiting_otp" | "inactive";

export interface WebIdentity {
  interfaceKind: "web";
  externalUserId: string;
  displayName: string;
}

export interface ChatSource {
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  locator: string;
}

export interface ChatResponse {
  text: string;
  sources: ChatSource[];
  plans?: PlanLink[];
}

export interface VoiceResponse extends ChatResponse {
  transcript: string;
  transcriptionModel: string;
}

export interface ImageInput {
  base64: string;
  mimeType: "image/jpeg" | "image/png";
  text?: string;
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

export interface VerifyResult {
  verified: true;
  active: boolean;
  support?: ChatResponse;
}

export interface WebBackendPort {
  authStatus(identity: WebIdentity): Promise<AuthState>;
  requestCode(identity: WebIdentity, email: string): Promise<void>;
  verifyCode(identity: WebIdentity, code: string): Promise<VerifyResult>;
  claimAccount(identity: WebIdentity): Promise<VerifyResult>;
  unbind(identity: WebIdentity): Promise<void>;
  chat(identity: WebIdentity, text: string, requestId: string): Promise<ChatResponse>;
  chatVoice(
    identity: WebIdentity,
    audioBase64: string,
    mimeType: string,
    durationSeconds: number,
    requestId: string,
  ): Promise<VoiceResponse>;
  chatImage(
    identity: WebIdentity,
    image: ImageInput,
    requestId: string,
  ): Promise<ChatResponse>;
  supportChat(identity: WebIdentity, text: string, requestId: string): Promise<ChatResponse>;
}

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export class WebBackendClient implements WebBackendPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly serviceToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async authStatus(identity: WebIdentity): Promise<AuthState> {
    const response = await this.request("/v1/internal/auth/status", { identity });
    if (!response.ok) throw await this.error(response);
    return authStatusSchema.parse(await response.json()).state;
  }

  async requestCode(identity: WebIdentity, email: string): Promise<void> {
    const response = await this.request("/v1/internal/auth/request-code", { identity, email });
    if (!response.ok) throw await this.error(response);
  }

  async verifyCode(identity: WebIdentity, code: string): Promise<VerifyResult> {
    const response = await this.request("/v1/internal/auth/verify-code", { identity, code });
    if (!response.ok) throw await this.error(response);
    const result = verifySchema.parse(await response.json());
    return {
      verified: result.verified,
      active: result.active,
      ...(result.support ? { support: result.support } : {}),
    };
  }

  async claimAccount(identity: WebIdentity): Promise<VerifyResult> {
    const response = await this.request("/v1/internal/auth/claim-account", { identity });
    if (!response.ok) throw await this.error(response);
    const result = verifySchema.parse(await response.json());
    return { verified: result.verified, active: result.active };
  }

  async unbind(identity: WebIdentity): Promise<void> {
    const response = await this.request("/v1/internal/unbind", { identity });
    if (!response.ok) throw await this.error(response);
  }

  async chat(identity: WebIdentity, text: string, requestId: string): Promise<ChatResponse> {
    const response = await this.request("/v1/internal/chat", { identity, text, requestId });
    if (!response.ok) throw await this.error(response);
    return chatSchema.parse(await response.json());
  }

  async chatVoice(
    identity: WebIdentity,
    audioBase64: string,
    mimeType: string,
    durationSeconds: number,
    requestId: string,
  ): Promise<VoiceResponse> {
    const response = await this.request("/v1/internal/voice-chat", {
      identity,
      audioBase64,
      mimeType,
      durationSeconds,
      requestId,
    });
    if (!response.ok) throw await this.error(response);
    return voiceSchema.parse(await response.json());
  }

  async chatImage(
    identity: WebIdentity,
    image: ImageInput,
    requestId: string,
  ): Promise<ChatResponse> {
    const response = await this.request("/v1/internal/image-chat", {
      identity,
      imageBase64: image.base64,
      mimeType: image.mimeType,
      ...(image.text ? { text: image.text } : {}),
      requestId,
    });
    if (!response.ok) throw await this.error(response);
    return chatSchema.parse(await response.json());
  }

  async supportChat(identity: WebIdentity, text: string, requestId: string): Promise<ChatResponse> {
    const response = await this.request("/v1/internal/support-chat", { identity, text, requestId });
    if (!response.ok) throw await this.error(response);
    return supportSchema.parse(await response.json());
  }

  private request(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": this.serviceToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(75_000),
    });
  }

  private async error(response: Response): Promise<BackendApiError> {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    return new BackendApiError(response.status, payload.error ?? `backend_${response.status}`);
  }
}
