import OpenAI from "openai";
import { z } from "zod";
import type { TradeExtractor } from "../../domain/trade-extractor.js";
import type { TradeExtractionCall } from "../../domain/trade-assessment-types.js";

const nullableNumber = z.number().nullish().transform((value) => value ?? null);
const nullableBoolean = z.boolean().nullish().transform((value) => value ?? null);
const remainingAllowances = z.object({
  daily: z.number().nullish(),
  weekly: z.number().nullish(),
  monthly: z.number().nullish(),
}).nullish().transform((value) => {
  if (value?.daily == null || value.weekly == null || value.monthly == null) return null;
  return { daily: value.daily, weekly: value.weekly, monthly: value.monthly };
});
const direction = z.preprocess(
  (value) => typeof value === "string" ? value.toLowerCase() : value,
  z.enum(["long", "short"]).nullish(),
).transform((value) => value ?? null);

const schema = z.object({
  is_trade_assessment: z.boolean().default(false),
  direction,
  entry_price: nullableNumber,
  stop_price: nullableNumber,
  target_prices: z.array(z.number()).nullish().transform((value) => value ?? []),
  risk_allowance: nullableNumber,
  monetary_loss_per_unit_at_stop: nullableNumber,
  position_unit_increment: nullableNumber,
  planned_position_size: nullableNumber,
  remaining_loss_allowance: remainingAllowances,
  stop_order_planned: nullableBoolean,
  no_trade_condition_disclosed: z.boolean().default(false),
  missing_fields: z.array(z.string()).nullish().transform((value) => value ?? []),
});

const prompt = `Extract a proposed trade plan from the conversation. Return one JSON object only.
Never invent values. Set null when the user did not explicitly provide a value.
Return every key below. Use these exact key names and do not use aliases:
{
  "is_trade_assessment": boolean,
  "direction": "long" | "short" | null,
  "entry_price": number | null,
  "stop_price": number | null,
  "target_prices": number[],
  "risk_allowance": number | null,
  "monetary_loss_per_unit_at_stop": number | null,
  "position_unit_increment": number | null,
  "planned_position_size": number | null,
  "remaining_loss_allowance": {"daily": number, "weekly": number, "monthly": number} | null,
  "stop_order_planned": boolean | null,
  "no_trade_condition_disclosed": boolean,
  "missing_fields": string[]
}
is_trade_assessment is true only when the user asks to assess, validate, size, plan,
enter or manage a trade. Copy direction from explicit words such as long, short, buy
or sell. target_prices must contain only explicit targets. stop_order_planned may be
true only if the user states an actual stop order is or will be placed; a stop price
alone is not enough. no_trade_condition_disclosed is true only for an explicit
disclosure of severe stress, exhaustion, intoxication, emotional unsettlement, or
trying to recover losses. risk_allowance, monetary_loss_per_unit_at_stop and
position_unit_increment must come from the user, not assumptions. Put remaining daily,
weekly and monthly losses inside remaining_loss_allowance. missing_fields lists
material fields that are still absent. Keep every numeric field a JSON number.`;

export interface DeepSeekTradeExtractorOptions {
  apiKey: string;
  baseURL: string;
  model: string;
}

type DeepSeekRequest = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
  thinking: { type: "disabled" };
};

interface DeepSeekCompletionClient {
  create(request: DeepSeekRequest): Promise<{
    choices: Array<{
      message: { content: string | null };
      finish_reason?: string | null;
    }>;
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | null;
  }>;
}

interface DeepSeekClientOptions extends DeepSeekTradeExtractorOptions {
  client?: DeepSeekCompletionClient;
}

export class DeepSeekTradeExtractor implements TradeExtractor {
  private readonly completions: DeepSeekCompletionClient;

  constructor(private readonly options: DeepSeekClientOptions) {
    this.completions =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        timeout: 45_000,
        maxRetries: 1,
      }).chat.completions;
  }

  async extract(
    text: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<TradeExtractionCall> {
    const conversation = history.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
    const response = await this.completions.create({
      model: this.options.model,
      temperature: 0,
      max_tokens: 900,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Conversation:\n${conversation}\n\nCurrent message:\n${text}` },
      ],
    });
    const content = response.choices[0]?.message.content?.trim();
    if (!content) {
      const finishReason = response.choices[0]?.finish_reason ?? "unknown";
      throw new Error(`Trade extraction returned no content (${finishReason}).`);
    }
    const parsed = schema.parse(JSON.parse(content));
    return {
      trade: {
        isTradeAssessment: parsed.is_trade_assessment,
        direction: parsed.direction,
        entryPrice: parsed.entry_price,
        stopPrice: parsed.stop_price,
        targetPrices: parsed.target_prices,
        riskAllowance: parsed.risk_allowance,
        monetaryLossPerUnitAtStop: parsed.monetary_loss_per_unit_at_stop,
        positionUnitIncrement: parsed.position_unit_increment,
        plannedPositionSize: parsed.planned_position_size,
        remainingLossAllowance: parsed.remaining_loss_allowance,
        stopOrderPlanned: parsed.stop_order_planned,
        noTradeConditionDisclosed: parsed.no_trade_condition_disclosed,
        missingFields: parsed.missing_fields,
      },
      model: response.model || this.options.model,
      provider: "deepseek",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }
}
