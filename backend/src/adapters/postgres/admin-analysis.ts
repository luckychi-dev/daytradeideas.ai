import type { Pool } from "pg";
import type { AdminAnalysis } from "../../domain/admin-types.js";

export async function loadAdminAnalysis(
  pool: Pool,
  periodDays: number,
): Promise<AdminAnalysis> {
  const since = `now() - ($1 * interval '1 day')`;
  const [totals, statuses, failedRules, providers, sources] = await Promise.all([
    pool.query<{
      answers: string;
      assessed: string;
      cost: string;
      average_latency: string;
      max_latency: string;
    }>(
      `SELECT COUNT(*)::text AS answers,
              COUNT(rule_assessment)::text AS assessed,
              COALESCE(SUM(estimated_cost_usd), 0)::text AS cost,
              COALESCE(ROUND(AVG(latency_ms)), 0)::text AS average_latency,
              COALESCE(MAX(latency_ms), 0)::text AS max_latency
       FROM answer_audits WHERE created_at >= ${since}`,
      [periodDays],
    ),
    pool.query<{
      status: string;
      count: string;
    }>(
      `SELECT COALESCE(rule_assessment->>'overallStatus',
                       rule_assessment->>'status', 'UNASSESSED') AS status,
              COUNT(*)::text AS count
       FROM answer_audits WHERE created_at >= ${since}
       GROUP BY 1 ORDER BY COUNT(*) DESC`,
      [periodDays],
    ),
    pool.query<{
      rule_id: string;
      count: string;
    }>(
      `SELECT gate->>'ruleId' AS rule_id, COUNT(*)::text AS count
       FROM answer_audits a
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(a.rule_assessment->'gates') = 'array'
              THEN a.rule_assessment->'gates' ELSE '[]'::jsonb END
       ) AS gate
       WHERE a.created_at >= ${since} AND gate->>'status' = 'FAIL'
       GROUP BY 1 ORDER BY COUNT(*) DESC`,
      [periodDays],
    ),
    pool.query<{
      provider: string;
      model: string;
      answers: string;
      input_tokens: string;
      output_tokens: string;
      cost: string;
    }>(
      `SELECT provider, model, COUNT(*)::text AS answers,
              COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::text AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0)::text AS cost
       FROM answer_audits WHERE created_at >= ${since}
       GROUP BY provider, model ORDER BY COUNT(*) DESC`,
      [periodDays],
    ),
    pool.query<{
      source_id: string;
      citations: string;
    }>(
      `SELECT cited.source_id, COUNT(*)::text AS citations
       FROM answer_audits a
       CROSS JOIN LATERAL unnest(a.source_ids) AS cited(source_id)
       WHERE a.created_at >= ${since}
       GROUP BY cited.source_id ORDER BY COUNT(*) DESC LIMIT 10`,
      [periodDays],
    ),
  ]);
  const summary = totals.rows[0] ?? {
    answers: "0",
    assessed: "0",
    cost: "0",
    average_latency: "0",
    max_latency: "0",
  };
  return {
    periodDays,
    totalAnswers: Number(summary.answers ?? 0),
    assessedAnswers: Number(summary.assessed ?? 0),
    totalCostUsd: Number(summary.cost ?? 0),
    averageLatencyMs: Number(summary.average_latency ?? 0),
    maxLatencyMs: Number(summary.max_latency ?? 0),
    byAssessmentStatus: statuses.rows.map((row) => ({
      status: row.status,
      count: Number(row.count ?? 0),
    })),
    failedRules: failedRules.rows.map((row) => ({
      ruleId: row.rule_id,
      count: Number(row.count ?? 0),
    })),
    byProvider: providers.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      answers: Number(row.answers ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      costUsd: Number(row.cost ?? 0),
    })),
    topSources: sources.rows.map((row) => ({
      sourceId: row.source_id,
      citations: Number(row.citations ?? 0),
    })),
  };
}
