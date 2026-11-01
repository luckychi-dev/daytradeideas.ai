export function backendErrorMessage(code: string): string {
  if (code === "monthly_budget_reached") {
    return "The AI service has reached its configured monthly budget. Please try again later.";
  }
  if (code === "daily_message_limit_reached") {
    return "You have reached today's mentor message limit. Please try again tomorrow.";
  }
  if (code === "daily_voice_limit_reached") {
    return "You have reached today's voice-note limit. Please try again tomorrow.";
  }
  if (code === "request_in_progress") {
    return "I'm still working on that message. Please wait a moment.";
  }
  return "I couldn't complete that answer safely. Please try again shortly.";
}
