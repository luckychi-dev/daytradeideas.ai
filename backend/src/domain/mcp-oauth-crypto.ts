import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PKCE_VALUE = /^[A-Za-z0-9._~-]{43,128}$/;

export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(digest(left)), Buffer.from(digest(right)));
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  return PKCE_VALUE.test(verifier) &&
    createHash("sha256").update(verifier).digest("base64url") === challenge;
}
