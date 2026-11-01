import { describe, expect, it } from "vitest";
import { telegramLaunchLink } from "./telegram-link.js";

const botUrl = "https://t.me/jasonsenaibot";

describe("Telegram launch links", () => {
  it("opens the Android Telegram app with a browser fallback", () => {
    const link = telegramLaunchLink(botUrl, {
      userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    });
    expect(link.href).toContain("intent://resolve?domain=jasonsenaibot&start=web");
    expect(link.href).toContain("package=org.telegram.messenger");
    expect(link.href).toContain(encodeURIComponent(`${botUrl}?start=web`));
    expect(link.target).toBeUndefined();
  });

  it("opens the iPhone Telegram app without loading t.me", () => {
    const link = telegramLaunchLink(botUrl, {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
    });
    expect(link).toEqual({
      href: "tg://resolve?domain=jasonsenaibot&start=web",
    });
  });

  it("keeps the web fallback for desktop browsers", () => {
    expect(telegramLaunchLink(botUrl, {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      platform: "MacIntel",
      maxTouchPoints: 0,
    })).toEqual({
      href: "https://t.me/jasonsenaibot?start=web",
      target: "_blank",
    });
  });
});
