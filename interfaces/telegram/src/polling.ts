import type { TelegramClient } from "./client.js";
import type { TelegramHandler } from "./handler.js";

export interface TelegramPollingOptions {
  client: TelegramClient;
  handler: TelegramHandler;
  warn(data: unknown, message?: string): void;
}

export class TelegramPoller {
  private running = false;
  private offset: number | undefined;

  constructor(private readonly options: TelegramPollingOptions) {}

  stop(): void {
    this.running = false;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      try {
        const updates = await this.options.client.getUpdates(this.offset);
        for (const update of updates) {
          await this.options.handler.handle(update).catch((error) => {
            this.options.warn(
              { errorName: error instanceof Error ? error.name : "UnknownError" },
              "Telegram polling update failed.",
            );
          });
          if (this.isUpdateWithId(update)) this.offset = update.update_id + 1;
        }
      } catch (error) {
        if (!this.running) return;
        this.options.warn(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Telegram polling failed; retrying.",
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  private isUpdateWithId(update: unknown): update is { update_id: number } {
    return typeof update === "object" &&
      update !== null &&
      "update_id" in update &&
      typeof update.update_id === "number";
  }
}
