import type { AppConfig } from "../../config.js";
import type { SpeechProvider } from "../../domain/ports.js";
import { ChatterboxSpeechProvider } from "./chatterbox-speech.js";

export function createSpeechProvider(config: AppConfig): SpeechProvider | undefined {
  if (config.VOICE_OUTPUT_PROVIDER !== "chatterbox") return undefined;
  return new ChatterboxSpeechProvider({
    baseURL: config.CHATTERBOX_BASE_URL,
    ...(config.CHATTERBOX_PASSCODE
      ? { passcode: config.CHATTERBOX_PASSCODE }
      : {}),
    ...(config.CHATTERBOX_SESSION_COOKIE
      ? { sessionCookie: config.CHATTERBOX_SESSION_COOKIE }
      : {}),
    voiceMode: config.CHATTERBOX_VOICE_MODE,
    voiceId: config.CHATTERBOX_VOICE_ID,
    timeoutMs: config.CHATTERBOX_TTS_TIMEOUT_MS,
  });
}
