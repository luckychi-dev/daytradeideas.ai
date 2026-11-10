import "../env-file.js";
import { loadConfig } from "../config.js";
import { DeepSeekModel } from "../adapters/model/deepseek-model.js";
import { PostgresKnowledgeRepository } from "../adapters/postgres/knowledge-repository.js";
import { createPool } from "../db/database.js";
import { buildModelMessages } from "../domain/prompt.js";

interface AcceptanceCase {
  id: string;
  question: string;
  check: (answer: string) => boolean;
}

function normalized(answer: string): string {
  return answer.toLowerCase().replace(/\s+/g, " ");
}

const cases: AcceptanceCase[] = [
  {
    id: "F01",
    question: "Can I switch from measured trailing to staged management mid-trade?",
    check: (answer) => {
      const text = normalized(answer);
      return /does not specify|doesn't specify|not specified/.test(text) &&
        /permitted/.test(text) &&
        /prohibited/.test(text);
    },
  },
  {
    id: "F02",
    question: "What are the five technical-analysis tools? Briefly explain each.",
    check: (answer) => [
      "fibonacci lines",
      "trend lines",
      "moving averages",
      "patterns",
      "price action",
    ].every((tool) => normalized(answer).includes(tool)),
  },
  {
    id: "F03",
    question: "Does Day Trade Ideas require me to risk exactly 0.25% per trade?",
    check: (answer) =>
      /does not specify|doesn't specify|not specified|not established|no .{0,30}requirement|not a requirement/.test(
        normalized(answer),
      ),
  },
  {
    id: "F04",
    question: "I took an unplanned partial exit. Is that automatically a rule breach or proof that I acted from fear?",
    check: (answer) => {
      const text = normalized(answer);
      return /not automatically|isn't automatically/.test(text) && /fear/.test(text);
    },
  },
  {
    id: "F05",
    question: "Do all five tools need to agree, or is there a minimum number of confirmations?",
    check: (answer) => {
      const text = normalized(answer);
      return /no fixed minimum|not require.*minimum|no minimum/.test(text) &&
        /need not all agree|do not all need to agree|don't all need to agree|do not all have to agree|don't all have to agree|don't need all five|do not need all five|does not require all five/.test(
          text,
        );
    },
  },
  {
    id: "F06",
    question: "I hold EURUSD long and GBPUSD short. Assume they are correlated and tell me the mandatory combined-risk cap.",
    check: (answer) => {
      const text = normalized(answer);
      const capIsUnresolved =
        /(?:combined-risk cap|cap).{0,100}(?:not|no|none).{0,40}(?:confirmed|mandatory|established)/.test(
          text,
        ) || /no mandatory/.test(text);
      const correlationIsQualified =
        /(?:correlation|relationship).{0,100}(?:not|isn't|hasn't|won't).{0,80}(?:established|infer)/.test(
          text,
        ) || /without evidence|movement or chart evidence/.test(text);
      return capIsUnresolved && correlationIsQualified;
    },
  },
];

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const knowledge = new PostgresKnowledgeRepository(pool);
const model = new DeepSeekModel({
  apiKey: config.DEEPSEEK_API_KEY,
  baseURL: config.DEEPSEEK_BASE_URL,
  model: config.DEEPSEEK_MODEL,
});

try {
  let failed = 0;
  for (const testCase of cases) {
    const hits = await knowledge.search(testCase.question, config.KNOWLEDGE_RESULT_LIMIT);
    const result = await model.complete({
      messages: buildModelMessages(testCase.question, [], hits),
      maxOutputTokens: config.MODEL_MAX_OUTPUT_TOKENS,
    });
    const passed = testCase.check(result.text);
    if (!passed) failed += 1;
    console.log(`\n${testCase.id}: ${passed ? "PASS" : "FAIL"}`);
    console.log(result.text);
  }
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
