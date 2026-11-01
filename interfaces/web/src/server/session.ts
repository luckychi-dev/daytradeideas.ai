import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { WebIdentity } from "./backend-client.js";

export const SESSION_COOKIE = "dtiai_web_session";

export interface WebSession {
  cookieValue: string;
  identity: WebIdentity;
}

function signature(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

function isValidSignature(token: string, supplied: string, secret: string): boolean {
  const expected = Buffer.from(signature(token, secret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createSession(secret: string): WebSession {
  const token = randomBytes(32).toString("base64url");
  const externalUserId = createHash("sha256").update(token).digest("hex");
  return {
    cookieValue: `${token}.${signature(token, secret)}`,
    identity: {
      interfaceKind: "web",
      externalUserId,
      displayName: "Web visitor",
    },
  };
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function resolveSession(header: string | undefined, secret: string): WebSession {
  const cookieValue = readCookie(header, SESSION_COOKIE);
  if (!cookieValue) return createSession(secret);
  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return createSession(secret);
  const token = cookieValue.slice(0, separator);
  const supplied = cookieValue.slice(separator + 1);
  if (!isValidSignature(token, supplied, secret)) return createSession(secret);
  return {
    cookieValue,
    identity: {
      interfaceKind: "web",
      externalUserId: createHash("sha256").update(token).digest("hex"),
      displayName: "Web visitor",
    },
  };
}

export function sessionCookie(value: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
