import { describe, expect, it, vi } from "vitest";
import { DeepSeekTradeExtractor } from "./deepseek-trade-extractor.js";

const extracted = {
  is_trade_assessment: true,
  direction: "long",
  entry_price: 100,
  stop_price: 90,
  target_prices: [116],
  risk_allowance: 100,
  monetary_loss_per_unit_at_stop: 10,
  position_unit_increment: 1,
  planned_position_size: 1,
  remaining_loss_allowance: { daily: 100, weekly: 200, monthly: 300 },
  stop_order_planned: true,
  no_trade_condition_disclosed: false,
  missing_fields: [],
};

describe("DeepSeekTradeExtractor", () => {
  it("disables thinking mode and maps a complete JSON plan", async () => {
    const create = vi.fn(async () => ({
      choices: [{
        message: { content: JSON.stringify(extracted) },
        finish_reason: "stop",
      }],
      model: "deepseek-flash",
      usage: { prompt_tokens: 120, completion_tokens: 80 },
    }));
    const extractor = new DeepSeekTradeExtractor({
      apiKey: "test",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-flash",
      client: { create },
    });

    const result = await extractor.extract("Assess this trade", []);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-flash",
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    );
    expect(result).toMatchObject({
      trade: {
        direction: "long",
        entryPrice: 100,
        stopPrice: 90,
        targetPrices: [116],
      },
      inputTokens: 120,
      outputTokens: 80,
    });
  });

  it("reports the finish reason when thinking consumes the output", async () => {
    const extractor = new DeepSeekTradeExtractor({
      apiKey: "test",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-flash",
      client: {
        create: async () => ({
          choices: [{ message: { content: "" }, finish_reason: "length" }],
        }),
      },
    });

    await expect(extractor.extract("Assess this trade", []))
      .rejects.toThrow("Trade extraction returned no content (length).");
  });

  it("treats omitted fields as unknown and normalizes direction", async () => {
    const extractor = new DeepSeekTradeExtractor({
      apiKey: "test",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-flash",
      client: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                is_trade_assessment: true,
                direction: "LONG",
                entry_price: 100,
                stop_price: 90,
                target_prices: [115],
              }),
            },
          }],
        }),
      },
    });

    const result = await extractor.extract("Assess this trade", []);

    expect(result.trade).toMatchObject({
      direction: "long",
      riskAllowance: null,
      remainingLossAllowance: null,
      stopOrderPlanned: null,
    });
  });
});
