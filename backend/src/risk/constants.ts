export const RULE_IDS = {
  rewardRisk: "RISK-001",
  stopOrder: "RISK-002",
  stopWidening: "RISK-003",
  consistentRisk: "RISK-004",
  lossAllowance: "RISK-005",
  periodLimits: "RISK-007/008",
  breakeven: "TRADE-001",
  tightening: "TRADE-002",
  missedEntry: "TRADE-006",
  averagingLoss: "TRADE-007",
  psychology: "PSY-001",
  missingData: "DATA-001/002/003",
} as const;

export const MIN_REWARD_RISK = 1.5;
export const ENGINE_VERSION = "1.1.0";
export const RULE_VERSION = "canonical-v1.1";
