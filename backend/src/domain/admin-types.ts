export interface AdminOverview {
  subscribers: number;
  activeSubscribers: number;
  pendingSubscribers: number;
  suspendedSubscribers: number;
  conversations: number;
  messages: number;
  messagesToday: number;
  monthCostUsd: number;
  todayCostUsd: number;
  approvedChunks: number;
  validationChunks: number;
  answers24h: number;
  membershipEvents24h: number;
  memoryEnabledSubscribers: number;
  memoryItems: number;
  newFeedback: number;
}

export interface XaiPrepaidBalance {
  availableUsd: number;
  currency: "USD";
  checkedAt: string;
}

export interface AdminSubscriber {
  id: string;
  interfaceKind: string;
  externalUserId: string;
  displayName: string | null;
  status: string;
  verifiedEmail: string | null;
  wordpressUserId: number | null;
  membershipStatus: string | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
}

export interface AdminAnalysis {
  periodDays: number;
  totalAnswers: number;
  assessedAnswers: number;
  totalCostUsd: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  byAssessmentStatus: Array<{ status: string; count: number }>;
  failedRules: Array<{ ruleId: string; count: number }>;
  byProvider: Array<{
    provider: string;
    model: string;
    answers: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  topSources: Array<{ sourceId: string; citations: number }>;
}

export interface AdminAuditRecord {
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
}
