import OpenAI from "openai";
import type { ModelProvider } from "../../domain/ports.js";
import type { ModelRequest, ModelResult } from "../../domain/types.js";

type DeepSeekRequest = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
  thinking: { type: "disabled" };
};

interface DeepSeekCompletionClient {
  create(request: DeepSeekRequest): Promise<{
    choices: Array<{ message: { content: string | null } }>;
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | null;
  }>;
}

export interface DeepSeekOptions {
  apiKey: string;
  baseURL: string;
  model: string;
  client?: DeepSeekCompletionClient;
}

export class DeepSeekModel implements ModelProvider {
  private readonly completions: DeepSeekCompletionClient;

  constructor(private readonly options: DeepSeekOptions) {
    this.completions =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        timeout: 60_000,
        maxRetries: 1,
      }).chat.completions;
  }

  async complete(request: ModelRequest): Promise<ModelResult> {
    const completion = await this.completions.create({
      model: this.options.model,
      messages: request.messages,
      temperature: 0.2,
      max_tokens: request.maxOutputTokens,
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("The model provider returned no text.");
    return {
      text,
      model: completion.model || this.options.model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
