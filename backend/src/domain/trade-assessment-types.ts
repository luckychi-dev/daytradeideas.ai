import type { TradeAssessment, TradeDirection, RemainingLossAllowance } from "../risk/types.js";

export interface ExtractedTrade {
  isTradeAssessment: boolean;
  direction: TradeDirection | null;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrices: number[];
  riskAllowance: number | null;
  monetaryLossPerUnitAtStop: number | null;
  positionUnitIncrement: number | null;
  plannedPositionSize: number | null;
  remainingLossAllowance: RemainingLossAllowance | null;
  stopOrderPlanned: boolean | null;
  noTradeConditionDisclosed: boolean;
  missingFields: string[];
}

export interface TradeExtractionCall {
  trade: ExtractedTrade;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TradeAssessmentOutcome {
  context: string;
  status: TradeAssessment["overallStatus"];
  assessment?: TradeAssessment;
  usage?: TradeExtractionCall;
}

