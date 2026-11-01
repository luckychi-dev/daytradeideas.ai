import { describe, expect, it } from "vitest";
import { readCookie, resolveSession, SESSION_COOKIE, sessionCookie } from "./session.js";

const secret = "s".repeat(32);

describe("web session", () => {
  it("creates an opaque signed cookie and recovers the same identity", () => {
    const created = resolveSession(undefined, secret);
    const recovered = resolveSession(
      `${SESSION_COOKIE}=${encodeURIComponent(created.cookieValue)}`,
      secret,
    );

    expect(recovered.identity).toEqual(created.identity);
    expect(recovered.identity.externalUserId).toMatch(/^[a-f0-9]{64}$/);
    expect(recovered.cookieValue).not.toContain("displayName");
  });

  it("rejects a modified identity cookie", () => {
    const created = resolveSession(undefined, secret);
    const tampered = `${created.cookieValue.slice(0, -1)}x`;
    const resolved = resolveSession(
      `${SESSION_COOKIE}=${encodeURIComponent(tampered)}`,
      secret,
    );

    expect(resolved.cookieValue).not.toBe(tampered);
    expect(resolved.identity.externalUserId).not.toBe(created.identity.externalUserId);
  });

  it("marks the browser cookie HTTP-only and same-site", () => {
    const cookie = sessionCookie("test", true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("parses a named cookie safely", () => {
    expect(readCookie("other=1; dtiai_web_session=abc.def; x=2", SESSION_COOKIE))
      .toBe("abc.def");
  });
});
