export interface UsageEvent {
  subscriberId: string;
  model: string;
  provider: string;
  usageType: "chat" | "assessment" | "transcription" | "synthesis" | "vision";
  inputTokens: number;
  outputTokens: number;
  durationSeconds?: number;
  estimatedCostUsd: number;
  requestId: string;
}

export interface DailyUsage {
  requests: number;
  voiceSeconds: number;
}

export interface RuntimeSettings {
  monthlyBudgetUsd: number;
  dailyMessagesPerSubscriber: number;
  dailyVoiceSecondsPerSubscriber: number;
  tradeAssessmentEnabled: boolean;
  memoryEnabled: boolean;
  messageRetentionDays: number;
}
