import type { Pool } from "pg";
import type { RuntimeSettingsRepository } from "../../domain/ports.js";
import type { RuntimeSettings } from "../../domain/usage-types.js";

const keys: Record<keyof RuntimeSettings, string> = {
  monthlyBudgetUsd: "monthly_budget_usd",
  dailyMessagesPerSubscriber: "daily_messages_per_subscriber",
  dailyVoiceSecondsPerSubscriber: "daily_voice_seconds_per_subscriber",
  tradeAssessmentEnabled: "trade_assessment_enabled",
  memoryEnabled: "memory_enabled",
  messageRetentionDays: "message_retention_days",
};

export class PostgresRuntimeSettingsRepository implements RuntimeSettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<RuntimeSettings> {
    const result = await this.pool.query<{ key: string; value: unknown }>(
      "SELECT key, value FROM runtime_settings",
    );
    const values = new Map(result.rows.map((row) => [row.key, row.value]));
    return {
      monthlyBudgetUsd: Number(values.get(keys.monthlyBudgetUsd) ?? 20),
      dailyMessagesPerSubscriber: Number(values.get(keys.dailyMessagesPerSubscriber) ?? 60),
      dailyVoiceSecondsPerSubscriber: Number(values.get(keys.dailyVoiceSecondsPerSubscriber) ?? 600),
      tradeAssessmentEnabled: Boolean(values.get(keys.tradeAssessmentEnabled) ?? true),
      memoryEnabled: Boolean(values.get(keys.memoryEnabled) ?? false),
      messageRetentionDays: Number(values.get(keys.messageRetentionDays) ?? 365),
    };
  }

  async update(settings: RuntimeSettings, actor: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const [field, key] of Object.entries(keys) as Array<
        [keyof RuntimeSettings, string]
      >) {
        await client.query(
          `INSERT INTO runtime_settings (key, value, updated_by)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (key) DO UPDATE SET
             value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [key, JSON.stringify(settings[field]), actor],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

