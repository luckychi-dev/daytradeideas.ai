import type { Pool } from "pg";
import type { AdminOverview } from "../../domain/admin-types.js";

export async function loadAdminOverview(pool: Pool): Promise<AdminOverview> {
  const result = await pool.query<Record<string, string>>(
    `SELECT
      (SELECT COUNT(*) FROM subscribers)::text AS subscribers,
      (SELECT COUNT(*) FROM subscribers WHERE status='active')::text AS active_subscribers,
      (SELECT COUNT(*) FROM subscribers WHERE status='pending')::text AS pending_subscribers,
      (SELECT COUNT(*) FROM subscribers WHERE status='suspended')::text AS suspended_subscribers,
      (SELECT COUNT(*) FROM conversations)::text AS conversations,
      (SELECT COUNT(*) FROM messages)::text AS messages,
      (SELECT COUNT(*) FROM messages WHERE created_at >= date_trunc('day', now()))::text AS messages_today,
      (SELECT COALESCE(SUM(estimated_cost_usd),0) FROM usage_events
        WHERE created_at >= date_trunc('month', now()))::text AS month_cost,
      (SELECT COALESCE(SUM(estimated_cost_usd),0) FROM usage_events
        WHERE created_at >= date_trunc('day', now()))::text AS today_cost,
      (SELECT COUNT(*) FROM knowledge_chunks WHERE approval_status='approved')::text AS approved_chunks,
      (SELECT COUNT(*) FROM knowledge_chunks
        WHERE approval_status='validation_required')::text AS validation_chunks,
      (SELECT COUNT(*) FROM answer_audits
        WHERE created_at >= now() - interval '24 hours')::text AS answers_24h,
      (SELECT COUNT(*) FROM subscription_events
        WHERE received_at >= now() - interval '24 hours')::text AS events_24h,
      (SELECT COUNT(*) FROM memory_settings WHERE enabled=true)::text AS memory_subscribers,
      (SELECT COUNT(*) FROM memory_items)::text AS memory_items,
      (SELECT COUNT(*) FROM feedback_reports WHERE status='new')::text AS new_feedback`,
  );
  const row = result.rows[0] ?? {};
  return {
    subscribers: Number(row.subscribers ?? 0),
    activeSubscribers: Number(row.active_subscribers ?? 0),
    pendingSubscribers: Number(row.pending_subscribers ?? 0),
    suspendedSubscribers: Number(row.suspended_subscribers ?? 0),
    conversations: Number(row.conversations ?? 0),
    messages: Number(row.messages ?? 0),
    messagesToday: Number(row.messages_today ?? 0),
    monthCostUsd: Number(row.month_cost ?? 0),
    todayCostUsd: Number(row.today_cost ?? 0),
    approvedChunks: Number(row.approved_chunks ?? 0),
    validationChunks: Number(row.validation_chunks ?? 0),
    answers24h: Number(row.answers_24h ?? 0),
    membershipEvents24h: Number(row.events_24h ?? 0),
    memoryEnabledSubscribers: Number(row.memory_subscribers ?? 0),
    memoryItems: Number(row.memory_items ?? 0),
    newFeedback: Number(row.new_feedback ?? 0),
  };
}
