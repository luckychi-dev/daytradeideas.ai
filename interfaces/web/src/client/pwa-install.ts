interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallListener = (available: boolean) => void;
export type MobileInstallPlatform = "android" | "ios";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallListener>();

export function detectStandaloneApp(
  displayModes: string[],
  iosStandalone: boolean,
  referrer: string,
): boolean {
  return displayModes.some((mode) => ["standalone", "fullscreen", "minimal-ui"].includes(mode)) ||
    iosStandalone ||
    referrer.startsWith("android-app://");
}

export function isStandaloneApp(): boolean {
  const displayModes = ["standalone", "fullscreen", "minimal-ui"].filter(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
  return detectStandaloneApp(
    displayModes,
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    document.referrer,
  );
}

function notify(): void {
  const available = Boolean(deferredPrompt) && !isStandaloneApp();
  for (const listener of listeners) listener(available);
}

export function detectMobileInstallPlatform(
  agent: string,
  platform: string,
  maxTouchPoints: number,
): MobileInstallPlatform | null {
  const ipadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/i.test(agent) || ipadDesktopMode) return "ios";
  if (/Android/i.test(agent)) return "android";
  return null;
}

export function mobileInstallPlatform(): MobileInstallPlatform | null {
  return detectMobileInstallPlatform(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  );
}

if (typeof window !== "undefined" && !isStandaloneApp()) {
  window.addEventListener("beforeinstallprompt", ((event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  }) as EventListener);
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstall(listener: InstallListener): () => void {
  listeners.add(listener);
  listener(Boolean(deferredPrompt) && !isStandaloneApp());
  return () => listeners.delete(listener);
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt || isStandaloneApp()) return false;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return true;
}
