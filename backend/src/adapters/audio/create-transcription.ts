import type { TranscriptionProvider } from "../../domain/ports.js";
import type { AppConfig } from "../../config.js";
import { OpenAITranscriptionProvider } from "./openai-transcription.js";
import { XaiTranscriptionProvider } from "./xai-transcription.js";

export function createTranscriptionProvider(config: AppConfig): TranscriptionProvider {
  if (config.VOICE_TRANSCRIPTION_PROVIDER === "openai") {
    return new OpenAITranscriptionProvider({
      ...(config.OPENAI_API_KEY ? { apiKey: config.OPENAI_API_KEY } : {}),
      baseURL: config.OPENAI_BASE_URL,
      model: config.OPENAI_TRANSCRIBE_MODEL,
    });
  }
  return new XaiTranscriptionProvider({
    ...(config.XAI_API_KEY ? { apiKey: config.XAI_API_KEY } : {}),
    baseURL: config.XAI_BASE_URL,
    model: config.XAI_TRANSCRIBE_MODEL,
  });
}

