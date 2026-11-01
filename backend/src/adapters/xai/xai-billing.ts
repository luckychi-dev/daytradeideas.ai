import { z } from "zod";
import type { XaiBillingPort } from "../../domain/admin-ports.js";
import type { XaiPrepaidBalance } from "../../domain/admin-types.js";

const balanceSchema = z.object({
  total: z.object({
    val: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  }),
});

export interface XaiBillingClientOptions {
  managementKey?: string;
  teamId?: string;
  baseURL: string;
  timeoutMs?: number;
}

export class XaiBillingClient implements XaiBillingPort {
  constructor(private readonly options: XaiBillingClientOptions) {}

  async getPrepaidBalance(): Promise<XaiPrepaidBalance | null> {
    const { managementKey, teamId } = this.options;
    if (!managementKey || !teamId) return null;

    const baseURL = this.options.baseURL.replace(/\/+$/, "");
    const response = await fetch(
      `${baseURL}/v1/billing/teams/${encodeURIComponent(teamId)}/prepaid/balance`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${managementKey}`,
        },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      },
    );
    if (!response.ok) {
      throw new Error(`xAI billing request failed with status ${response.status}.`);
    }
    const parsed = balanceSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("xAI billing response was invalid.");

    const totalCents = Number(parsed.data.total.val);
    return {
      availableUsd: Number(Math.max(0, -totalCents / 100).toFixed(2)),
      currency: "USD",
      checkedAt: new Date().toISOString(),
    };
  }
}
