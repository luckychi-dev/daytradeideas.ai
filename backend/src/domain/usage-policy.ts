import type { RuntimeSettingsRepository, UsageRepository } from "./ports.js";

export class MonthlyBudgetExceededError extends Error {}
export class DailyMessageLimitError extends Error {}
export class DailyVoiceLimitError extends Error {}

export type UsageKind = "chat" | "voice";

export class UsagePolicyService {
  constructor(
    private readonly settings: RuntimeSettingsRepository,
    private readonly usage: UsageRepository,
  ) {}

  async assertAllowed(
    subscriberId: string,
    kind: UsageKind,
    voiceSeconds = 0,
  ): Promise<void> {
    const settings = await this.settings.get();
    if ((await this.usage.monthlySpendUsd()) >= settings.monthlyBudgetUsd) {
      throw new MonthlyBudgetExceededError();
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const usage = await this.usage.dailyUsage(subscriberId, startOfDay);
    if (usage.requests >= settings.dailyMessagesPerSubscriber) {
      throw new DailyMessageLimitError();
    }
    if (
      kind === "voice" &&
      usage.voiceSeconds + voiceSeconds > settings.dailyVoiceSecondsPerSubscriber
    ) {
      throw new DailyVoiceLimitError();
    }
  }

  async assertVoiceSeconds(
    subscriberId: string,
    voiceSeconds: number,
  ): Promise<void> {
    const settings = await this.settings.get();
    if ((await this.usage.monthlySpendUsd()) >= settings.monthlyBudgetUsd) {
      throw new MonthlyBudgetExceededError();
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const usage = await this.usage.dailyUsage(subscriberId, startOfDay);
    if (usage.voiceSeconds + voiceSeconds > settings.dailyVoiceSecondsPerSubscriber) {
      throw new DailyVoiceLimitError();
    }
  }
}
