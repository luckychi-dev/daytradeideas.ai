import type { WebSpeechPort } from "./speech-backend-client.js";

export const successfulSpeech: WebSpeechPort = {
  synthesize: async () => ({
    audioBase64: "T2dnUw==",
    mimeType: "audio/ogg",
    model: "chatterbox-opus",
    voiceId: "Jason Sen 01",
    durationSeconds: 3,
  }),
};
