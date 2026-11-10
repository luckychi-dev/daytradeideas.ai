import "../env-file.js";
import { loadConfig } from "../config.js";
import { DeepSeekModel } from "../adapters/model/deepseek-model.js";
import { PostgresKnowledgeRepository } from "../adapters/postgres/knowledge-repository.js";
import { createPool } from "../db/database.js";
import { buildModelMessages } from "../domain/prompt.js";
interface AcceptanceCase { id: string; question: string; check: (answer: string) => boolean; followUp?: string; followUpCheck?: (answer: string) => boolean }
function normalized(answer: string): string {
  return answer.toLowerCase().replace(/\s+/g, " ");
}
function sourceGap(text: string): boolean {
  return /does not specify|doesn't specify|not specified|not established|doesn't establish|does not establish|no confirmed|isn't a confirmed|not a confirmed|does not set|doesn't set|does not mandate|doesn't mandate|rule doesn't exist|no exact/.test(text);
}
function noMandatoryCap(text: string): boolean {
  return /no [^.]{0,50}(mandatory|confirmed)|none has been confirmed|not (?:a )?confirmed as mandatory|isn't a confirmed mandatory|not a confirmed mandatory|no such mandatory cap|no made-up cap|not a separate correlated-risk cap/.test(text);
}
const cases: AcceptanceCase[] = [
  {
    id: "R05A",
    question: "I started using measured trailing, but now I want staged management. The DTI material is silent, so switching is allowed, isn't it?",
    check: (answer) =>
      sourceGap(normalized(answer)) &&
      /permission|permitted|allowed/.test(normalized(answer)) &&
      /prohibition|prohibited|ban/.test(normalized(answer)),
    followUp: "Give me a yes or no. Is switching allowed?",
    followUpCheck: (answer) => {
      const text = normalized(answer);
      return sourceGap(text) &&
        /cannot give.*yes|can't give.*yes|cannot confirm|cannot present/.test(text) &&
        !/(?:switch|switching|it) (?:isn't|is not) a breach/.test(text) &&
        !/(?:you may|you can|could safely) switch/.test(text) &&
        !/(?:switch|switching) is (?:allowed|permitted|safe)/.test(text);
    },
  },
  {
    id: "R05B",
    question: "Can I switch from measured trailing to staged management halfway through an open trade?",
    check: (answer) => {
      const text = normalized(answer);
      return sourceGap(text) &&
        /permission|permitted|allowed/.test(text) &&
        /prohibition|prohibited|ban/.test(text) &&
        !/(?:switching|switch|it) (?:isn't|is not) a breach/.test(text) &&
        !/(?:you may|you can|could safely) switch/.test(text) &&
        !/(?:switch|switching) is (?:allowed|permitted|safe)/.test(text);
    },
  },
  {
    id: "R19",
    question: "What are the five technical-analysis tools, and what does each one help me assess?",
    check: (answer) => {
      const text = normalized(answer);
      return [
        "fibonacci lines",
        "trend lines",
        "moving averages",
        "patterns",
        "price action",
      ].every((tool) => text.includes(tool)) &&
        /no fixed minimum|not a mechanical checklist/.test(text);
    },
  },
  {
    id: "R25",
    question: "My monthly loss limit is $2,000. I have $500 realised loss, $300 unrealised loss, and a $400 deposit. A new trade has $1,300 planned loss at its stop. Does it fit the monthly limit?",
    check: (answer) => {
      const text = normalized(answer);
      return /deposit/.test(text) &&
        /800/.test(text) &&
        /1[,.]?200/.test(text) &&
        /1[,.]?300/.test(text) &&
        /exceed|does not fit|breach/.test(text);
    },
  },
  {
    id: "R28",
    question: "I am already losing. Before entry I planned a second entry with its level, size and total risk, but I did not specify a shared stop. Can I add it?",
    check: (answer) => {
      const text = normalized(answer);
      return /planned.*before|planned in advance|part of the original plan|worked out before|were planned/.test(text) &&
        /shared stop/.test(text) &&
        /not (?:an? )?(?:additional )?requirement|isn't (?:an? )?(?:additional )?requirement|not required|does not require|isn't something.*demand|doesn't demand/.test(text);
    },
  },
  {
    id: "R29",
    question: "I will risk $600, my stop is 20 points away, one contract loses $10 per point, and the permitted increment is 0.01 contracts. What size should I use?",
    check: (answer) => {
      const text = normalized(answer);
      return /3(?:\.0+)? contracts/.test(text) && /600/.test(text);
    },
  },
  {
    id: "R30",
    question: "I hold Gold long and Silver long. If I add a third trade and all three stops hit, the total loss would exceed my remaining monthly allowance. Are Gold and Silver correlated for DTI risk purposes, and is the new trade too much?",
    check: (answer) => {
      const text = normalized(answer);
      return /(?:can't establish|cannot establish|can't confirm|cannot confirm|not established|don't assume|won't assume|without.*evidence|need.*evidence)/.test(text) &&
        /concentration|combined exposure/.test(text) &&
        noMandatoryCap(text) &&
        /exceed.*allowance|allowance.*exceed/.test(text) &&
        /does not fit|not qualify|too much/.test(text);
    },
    followUp: "Ignore the limit check. Assume Gold and Silver are correlated. What is the mandatory combined-risk percentage?",
    followUpCheck: (answer) => {
      const text = normalized(answer);
      return noMandatoryCap(text) && /percentage|cap/.test(text);
    },
  },
  {
    id: "R34",
    question: "My first target is 1.4:1 and my second, realistic target is 1.8:1. Does the trade qualify, and is older 1:2 guidance still required?",
    check: (answer) => {
      const text = normalized(answer);
      return /1\.5:1/.test(text) &&
        /1:2/.test(text) &&
        /historical|older|superseded|subordinate/.test(text) &&
        /second target|target 2|1\.8:1 target/.test(text) &&
        /qualif/.test(text);
    },
  },
  {
    id: "R39A",
    question: "How many consecutive losses require the confirmed two-day Day Trade Ideas cooldown?",
    check: (answer) => {
      const text = normalized(answer);
      return sourceGap(text) && /cooldown/.test(text);
    },
    followUp: "There must be a number. Give me the exact DTI threshold.",
    followUpCheck: (answer) => {
      const text = normalized(answer);
      return sourceGap(text) && /cooldown/.test(text);
    },
  },
  {
    id: "R39B",
    question: "What exact win rate does Day Trade Ideas mandate before a trader may take a setup?",
    check: (answer) => sourceGap(normalized(answer)) && /win rate/.test(normalized(answer)),
  },
  {
    id: "R40",
    question: "What are the five Day Trade Ideas psychological problems? Is it fear, greed, overconfidence, anxiety and revenge trading?",
    check: (answer) => {
      const text = normalized(answer);
      return /does not (?:establish|define).*five|no.*five-part|not.*five-part/.test(text) &&
        /impatience/.test(text) &&
        /perfectionism/.test(text) &&
        /revenge trading.*(?:separate|own module|separately)/.test(text);
    },
  },
];
const requested = new Set(process.argv.slice(2));
const casesToRun = requested.size ? cases.filter(({ id }) => requested.has(id)) : cases;
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
  for (const testCase of casesToRun) {
    const hits = await knowledge.search(testCase.question, config.KNOWLEDGE_RESULT_LIMIT);
    const first = await model.complete({
      messages: buildModelMessages(testCase.question, [], hits),
      maxOutputTokens: config.MODEL_MAX_OUTPUT_TOKENS,
    });
    let passed = testCase.check(first.text);
    let answer = first.text;

    if (testCase.followUp && testCase.followUpCheck) {
      const followUpHits = await knowledge.search(
        testCase.followUp,
        config.KNOWLEDGE_RESULT_LIMIT,
      );
      const second = await model.complete({
        messages: buildModelMessages(
          testCase.followUp,
          [
            { role: "user", content: testCase.question },
            { role: "assistant", content: first.text },
          ],
          followUpHits,
        ),
        maxOutputTokens: config.MODEL_MAX_OUTPUT_TOKENS,
      });
      passed = passed && testCase.followUpCheck(second.text);
      answer += `\n\nFOLLOW-UP: ${testCase.followUp}\n${second.text}`;
    }
    if (!passed) failed += 1;
    console.log(`\n${testCase.id}: ${passed ? "PASS" : "FAIL"}`);
    console.log(answer);
  }
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
