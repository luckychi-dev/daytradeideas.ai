import type { RuntimeSettingsRepository } from "./ports.js";

export interface RetentionRepository {
  purgeBefore(cutoff: Date): Promise<{ messages: number; answers: number }>;
}

export class RetentionService {
  constructor(
    private readonly settings: RuntimeSettingsRepository,
    private readonly repository: RetentionRepository,
  ) {}

  async run(): Promise<{ cutoff: string; messages: number; answers: number }> {
    const settings = await this.settings.get();
    const cutoff = new Date(Date.now() - settings.messageRetentionDays * 86_400_000);
    const deleted = await this.repository.purgeBefore(cutoff);
    return { cutoff: cutoff.toISOString(), ...deleted };
  }
}

