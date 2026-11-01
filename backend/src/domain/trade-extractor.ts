import type { ExtractedTrade, TradeExtractionCall } from "./trade-assessment-types.js";

export interface TradeExtractor {
  extract(
    text: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<TradeExtractionCall>;
}

