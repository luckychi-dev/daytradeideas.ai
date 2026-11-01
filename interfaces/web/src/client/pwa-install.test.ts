import { describe, expect, it } from "vitest";
import { detectMobileInstallPlatform, detectStandaloneApp } from "./pwa-install.js";

describe("mobile install platform detection", () => {
  it("detects iPhone and iPad mobile Safari", () => {
    expect(detectMobileInstallPlatform(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "iPhone",
      5,
    )).toBe("ios");
    expect(detectMobileInstallPlatform(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      "MacIntel",
      5,
    )).toBe("ios");
  });

  it("detects Android and ignores desktop browsers", () => {
    expect(detectMobileInstallPlatform(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
      "Linux armv8l",
      5,
    )).toBe("android");
    expect(detectMobileInstallPlatform(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Win32",
      0,
    )).toBeNull();
  });

  it("hides installation UI in every installed-app display mode", () => {
    expect(detectStandaloneApp(["standalone"], false, "")).toBe(true);
    expect(detectStandaloneApp(["fullscreen"], false, "")).toBe(true);
    expect(detectStandaloneApp(["minimal-ui"], false, "")).toBe(true);
    expect(detectStandaloneApp([], true, "")).toBe(true);
    expect(detectStandaloneApp([], false, "android-app://com.android.chrome")).toBe(true);
    expect(detectStandaloneApp(["browser"], false, "https://example.com")).toBe(false);
  });
});
