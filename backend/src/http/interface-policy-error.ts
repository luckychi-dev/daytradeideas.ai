import {
  DailyMessageLimitError,
  DailyVoiceLimitError,
  MonthlyBudgetExceededError,
} from "../domain/usage-policy.js";
import { RequestInProgressError } from "../domain/request-coordinator.js";

export function policyError(error: unknown): { status: number; error: string } | null {
  if (error instanceof RequestInProgressError) {
    return { status: 409, error: "request_in_progress" };
  }
  if (error instanceof MonthlyBudgetExceededError) {
    return { status: 402, error: "monthly_budget_reached" };
  }
  if (error instanceof DailyMessageLimitError) {
    return { status: 429, error: "daily_message_limit_reached" };
  }
  if (error instanceof DailyVoiceLimitError) {
    return { status: 429, error: "daily_voice_limit_reached" };
  }
  return null;
}
