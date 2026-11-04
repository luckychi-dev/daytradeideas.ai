import { WebApiError } from "./api.js";

export function chatError(error: unknown): string {
  if (!(error instanceof WebApiError)) return "I couldn’t connect right now. Please try again.";
  if (error.code === "daily_message_limit_reached") return "You’ve reached today’s message limit.";
  if (error.code === "monthly_budget_reached") return "The mentor has reached its service budget.";
  if (error.code === "request_in_progress") return "The previous answer is still being prepared.";
  if (error.code === "subscriber_not_allowed") return "Your subscription needs to be verified again.";
  if (error.code === "vision_unavailable") return "Chart reading is not configured yet.";
  if (error.code === "image_too_large") return "That image is too large. Please choose a smaller one.";
  if (error.code === "voice_transcription_unavailable") return "Voice notes are not configured yet.";
  if (error.code === "no_speech_detected") {
    return "I couldn’t hear any speech. Try recording again a little closer to the microphone.";
  }
  if (error.code === "empty_response" || error.code === "invalid_response") {
    return "The mentor returned an empty response. Please try again.";
  }
  if (error.code === "voice_too_large") return "That voice note is too long or too large.";
  return "I couldn’t complete that answer safely. Please try again.";
}
