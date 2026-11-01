import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import type { WordPressBridge } from "../../domain/ports.js";
import type { MembershipPlan, WordPressVerification } from "../../domain/types.js";
import type { WordPressMembershipState } from "../../domain/types.js";

export class WordPressBridgeUnavailableError extends Error {}

const membershipSchema = z.object({
  id: z.number().int(),
  plan_id: z.number().int(),
  status: z.literal("wcm-active"),
  end_date: z.number().int().nullable(),
});
const verificationSchema = z.object({
  valid: z.boolean(),
  eligible: z.boolean(),
  wordpress_user_id: z.number().int().nullable(),
  email: z.string().email(),
  memberships: z.array(membershipSchema),
});
const membershipStateSchema = z.object({
  valid: z.boolean(),
  eligible: z.boolean(),
  wordpress_user_id: z.number().int().nullable(),
  memberships: z.array(membershipSchema),
});
const planSchema = z.object({
  product_id: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().nonnegative(),
  regular_price: z.number().nonnegative(),
  sale_price: z.number().nonnegative().nullable(),
  currency: z.string().min(3).max(3),
  billing_period: z.string().min(1),
  billing_interval: z.number().int().positive(),
  purchase_url: z.string().url(),
});
const plansSchema = z.object({ plans: z.array(planSchema) });

export interface WordPressBridgeOptions {
  baseUrl: string;
  secret?: string;
}

export class WordPressBridgeClient implements WordPressBridge {
  private readonly baseUrl: string;

  constructor(private readonly options: WordPressBridgeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  async requestCode(email: string): Promise<void> {
    const response = await this.signedPost("/request-code", { email });
    if (!response.ok) throw new Error(`WordPress code request failed with ${response.status}.`);
  }

  async verifyCode(email: string, code: string): Promise<WordPressVerification> {
    const response = await this.signedPost("/verify-code", { email, code });
    if (!response.ok) return {
      valid: false,
      eligible: false,
      wordpressUserId: null,
      email,
      memberships: [],
    };
    const result = verificationSchema.parse(await response.json());
    return {
      valid: result.valid,
      eligible: result.eligible,
      wordpressUserId: result.wordpress_user_id,
      email: result.email,
      memberships: result.memberships.map((membership) => ({
        id: membership.id,
        planId: membership.plan_id,
        status: membership.status,
        endDate: membership.end_date,
      })),
    };
  }

  async membershipStatus(wordpressUserId: number): Promise<WordPressMembershipState> {
    const response = await this.signedPost("/membership-status", {
      wordpress_user_id: wordpressUserId,
    });
    if (!response.ok) {
      return { valid: false, eligible: false, memberships: [] };
    }
    const result = membershipStateSchema.parse(await response.json());
    return {
      valid: result.valid,
      eligible: result.eligible,
      memberships: result.memberships.map((membership) => ({
        id: membership.id,
        planId: membership.plan_id,
        status: membership.status,
        endDate: membership.end_date,
      })),
    };
  }

  async plans(): Promise<MembershipPlan[]> {
    const response = await this.signedPost("/plans", {});
    if (!response.ok) {
      throw new WordPressBridgeUnavailableError();
    }
    return plansSchema.parse(await response.json()).plans.map((plan) => ({
      productId: plan.product_id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      regularPrice: plan.regular_price,
      salePrice: plan.sale_price,
      currency: plan.currency,
      billingPeriod: plan.billing_period,
      billingInterval: plan.billing_interval,
      purchaseUrl: plan.purchase_url,
    }));
  }

  private signedPost(path: string, payload: Record<string, unknown>): Promise<Response> {
    if (!this.options.secret || this.options.secret.length < 32) {
      throw new WordPressBridgeUnavailableError();
    }
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomUUID();
    const signature = createHmac("sha256", this.options.secret)
      .update(`${timestamp}\n${nonce}\n${body}`)
      .digest("hex");
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dtiai-timestamp": timestamp,
        "x-dtiai-nonce": nonce,
        "x-dtiai-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  }
}
