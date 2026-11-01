import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../domain/auth-service.js";
import type { PublicSupportPort } from "../domain/public-support-service.js";
import { RequestCoordinator } from "../domain/request-coordinator.js";
import { UsagePolicyService } from "../domain/usage-policy.js";
import type { Subscriber } from "../domain/types.js";
import { registerSupportRoute } from "./support-route.js";

const subscriber: Subscriber = {
  id: "visitor-a",
  interfaceKind: "web",
  externalUserId: "visitor",
  displayName: "Visitor",
  status: "pending",
  verifiedEmail: null,
  wordpressUserId: null,
  membershipStatus: null,
  accessExpiresAt: null,
  lastVerifiedAt: null,
};

describe("public support route", () => {
  it("allows a pending visitor to receive plan links", async () => {
    const app = Fastify();
    const support: PublicSupportPort = {
      reply: async () => ({
        text: "Here are the plans.",
        plans: [{
          productId: 1,
          name: "Index plan",
          description: "Index signals",
          price: 79,
          regularPrice: 79,
          salePrice: null,
          currency: "GBP",
          billingPeriod: "month",
          billingInterval: 1,
          purchaseUrl: "https://example.com/plan",
        }],
      }),
    };
    await registerSupportRoute(app, {
      auth: {
        status: async () => ({ state: "verification_required", subscriber }),
      } as AuthService,
      support,
      requests: new RequestCoordinator({
        begin: async () => ({ status: "new" }),
        complete: async () => {},
        fail: async () => {},
      }),
      usagePolicy: new UsagePolicyService(
        {
          get: async () => ({
            monthlyBudgetUsd: 20,
            dailyMessagesPerSubscriber: 60,
            dailyVoiceSecondsPerSubscriber: 600,
            tradeAssessmentEnabled: true,
            memoryEnabled: false,
            messageRetentionDays: 365,
          }),
          update: async () => {},
        },
        {
          record: async () => {},
          monthlySpendUsd: async () => 0,
          dailyUsage: async () => ({ requests: 0, voiceSeconds: 0 }),
        },
      ),
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/support-chat",
      payload: {
        identity: { interfaceKind: "web", externalUserId: "visitor" },
        text: "Show me the plans",
        requestId: "support-route-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      text: "Here are the plans.",
      plans: [{ name: "Index plan", purchaseUrl: "https://example.com/plan" }],
    });
    await app.close();
  });
});
