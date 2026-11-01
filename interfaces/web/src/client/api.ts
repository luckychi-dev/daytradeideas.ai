import type { PreparedImage, RecordedAudio } from "./media.js";
import type { ChatSource, PlanLink, SessionData, VerifyResult } from "./types.js";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class WebApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new WebApiError(payload.error ?? "request_failed");
  return payload as T;
}

export function getSession(): Promise<SessionData> {
  return request<SessionData>("/api/session");
}

export function requestVerificationCode(email: string): Promise<{ accepted: true }> {
  return request("/api/auth/request-code", { email });
}

export function verifyCode(code: string): Promise<VerifyResult> {
  return request("/api/auth/verify-code", { code });
}

export function logout(): Promise<{ loggedOut: true }> {
  return request("/api/logout", {});
}

export function sendMessage(
  text: string,
): Promise<{ text: string; sources: ChatSource[]; plans?: PlanLink[] }> {
  return request("/api/chat", { text });
}

export function sendVoice(
  audio: RecordedAudio,
): Promise<{
  text: string;
  sources: ChatSource[];
  transcript: string;
  transcriptionModel: string;
}> {
  return request("/api/voice-chat", {
    audioBase64: audio.base64,
    mimeType: audio.mimeType,
    durationSeconds: audio.durationSeconds,
  });
}

export function sendImage(
  image: PreparedImage,
  text: string,
): Promise<{ text: string; sources: ChatSource[]; plans?: PlanLink[] }> {
  return request("/api/image-chat", {
    imageBase64: image.base64,
    mimeType: image.mimeType,
    ...(text.trim() ? { text: text.trim() } : {}),
  });
}
