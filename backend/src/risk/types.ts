export type TradeDirection = "long" | "short";
export type GateStatus = "PASS" | "FAIL" | "NEEDS_INPUT" | "NOT_APPLICABLE";
export type AssessmentStatus = "PASS" | "FAIL" | "NEEDS_INPUT" | "NOT_APPLICABLE";

export interface GateResult {
  ruleId: string;
  status: GateStatus;
  reason: string;
}

export interface RemainingLossAllowance {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface LossLimitReached {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
}

export interface TradeAssessmentInput {
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  targetPrices: number[];
  qualifyingTargetIndex?: number;
  riskAllowance: number;
  monetaryLossPerUnitAtStop: number;
  positionUnitIncrement: number;
  plannedPositionSize?: number;
  remainingLossAllowance?: RemainingLossAllowance;
  lossLimitReached?: LossLimitReached;
  stopOrderPlanned: boolean;
  noTradeConditionDisclosed: boolean;
}

export interface TargetCalculation {
  targetPrice: number;
  rewardDistance: number;
  rewardRisk: number;
  meetsMinimum: boolean;
}

export interface TradeCalculations {
  stopDistance: number;
  maximumPositionSize: number;
  plannedPositionSize: number;
  plannedMonetaryRisk: number;
  qualifyingTargetIndex: number | null;
  targets: TargetCalculation[];
}

export interface TradeAssessment {
  overallStatus: AssessmentStatus;
  gates: GateResult[];
  calculations: TradeCalculations | null;
  engineVersion: string;
  ruleVersion: string;
}

export interface StopChangeInput {
  direction: TradeDirection;
  entryPrice: number;
  originalStopPrice: number;
  proposedStopPrice: number;
  favourableMove: number;
  originalPositionSize: number;
  proposedPositionSize: number;
  widerStopJustified: boolean;
  chartJustifiedTightening: boolean;
}

export interface StopChangeAssessment {
  overallStatus: AssessmentStatus;
  gates: GateResult[];
  originalRiskDistance: number | null;
  proposedRiskDistance: number | null;
  engineVersion: string;
  ruleVersion: string;
}
