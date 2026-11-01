export interface AnswerAuditRecord {
  subscriberId: string;
  requestId: string;
  question: string;
  answer: string;
  model: string;
  provider: string;
  sourceIds: string[];
  promptVersion: string;
  knowledgeVersion: string;
  ruleEngineVersion: string;
  ruleAssessment?: unknown;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}
