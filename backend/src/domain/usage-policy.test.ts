import { describe, expect, it } from "vitest";
import {
  DailyMessageLimitError,
  DailyVoiceLimitError,
  MonthlyBudgetExceededError,
  UsagePolicyService,
} from "./usage-policy.js";
import type { RuntimeSettingsRepository, UsageRepository } from "./ports.js";
import type { RuntimeSettings } from "./usage-types.js";

const defaults: RuntimeSettings = {
  monthlyBudgetUsd: 20,
  dailyMessagesPerSubscriber: 2,
  dailyVoiceSecondsPerSubscriber: 60,
  tradeAssessmentEnabled: true,
  memoryEnabled: false,
  messageRetentionDays: 365,
};

function service(overrides: {
  settings?: Partial<RuntimeSettings>;
  spend?: number;
  requests?: number;
  voiceSeconds?: number;
}) {
  const settings: RuntimeSettingsRepository = {
    get: async () => ({ ...defaults, ...overrides.settings }),
    update: async () => {},
  };
  const usage: UsageRepository = {
    record: async () => {},
    monthlySpendUsd: async () => overrides.spend ?? 0,
    dailyUsage: async () => ({
      requests: overrides.requests ?? 0,
      voiceSeconds: overrides.voiceSeconds ?? 0,
    }),
  };
  return new UsagePolicyService(settings, usage);
}

describe("UsagePolicyService", () => {
  it("blocks work after the monthly budget is reached", async () => {
    await expect(service({ spend: 20 }).assertAllowed("subscriber", "chat"))
      .rejects.toBeInstanceOf(MonthlyBudgetExceededError);
  });

  it("blocks excess daily messages and voice minutes", async () => {
    await expect(service({ requests: 2 }).assertAllowed("subscriber", "chat"))
      .rejects.toBeInstanceOf(DailyMessageLimitError);
    await expect(service({ voiceSeconds: 50 }).assertAllowed("subscriber", "voice", 11))
      .rejects.toBeInstanceOf(DailyVoiceLimitError);
  });

  it("allows usage within both limits", async () => {
    await expect(service({ spend: 2, requests: 1, voiceSeconds: 10 })
      .assertAllowed("subscriber", "voice", 20)).resolves.toBeUndefined();
  });
});

