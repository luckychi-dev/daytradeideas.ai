import { describe, expect, it, vi } from "vitest";
import { DeepSeekModel } from "./deepseek-model.js";

describe("DeepSeekModel", () => {
  it("disables thinking and returns a visible mentor answer", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "The 1.4R target fails the minimum gate." } }],
      model: "deepseek-flash",
      usage: { prompt_tokens: 80, completion_tokens: 20 },
    }));
    const model = new DeepSeekModel({
      apiKey: "test",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-flash",
      client: { create },
    });

    const result = await model.complete({
      messages: [{ role: "user", content: "Explain the failed gate." }],
      maxOutputTokens: 500,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: 500,
    }));
    expect(result).toMatchObject({
      text: "The 1.4R target fails the minimum gate.",
      inputTokens: 80,
      outputTokens: 20,
    });
  });
});
