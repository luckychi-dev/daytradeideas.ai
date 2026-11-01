export interface TelegramLaunch {
  href: string;
  target?: "_blank";
}

export interface TelegramDevice {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

export function telegramLaunchLink(
  baseUrl: string,
  device: TelegramDevice,
): TelegramLaunch {
  try {
    const webUrl = new URL(baseUrl);
    webUrl.searchParams.set("start", "web");
    const username = webUrl.pathname.split("/").filter(Boolean).at(-1);
    if (!username) return { href: webUrl.toString(), target: "_blank" };

    const android = /Android/i.test(device.userAgent);
    const ios = /iPad|iPhone|iPod/i.test(device.userAgent) ||
      (device.platform === "MacIntel" && device.maxTouchPoints > 1);
    const fallback = encodeURIComponent(webUrl.toString());

    if (android) {
      return {
        href: `intent://resolve?domain=${encodeURIComponent(username)}&start=web#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${fallback};end`,
      };
    }
    if (ios) {
      return {
        href: `tg://resolve?domain=${encodeURIComponent(username)}&start=web`,
      };
    }
    return { href: webUrl.toString(), target: "_blank" };
  } catch {
    return { href: baseUrl, target: "_blank" };
  }
}
