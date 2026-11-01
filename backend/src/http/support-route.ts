import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthService } from "../domain/auth-service.js";
import type { PublicSupportPort } from "../domain/public-support-service.js";
import type { RequestCoordinator } from "../domain/request-coordinator.js";
import type { SubscriberIdentity } from "../domain/types.js";
import type { UsagePolicyService } from "../domain/usage-policy.js";
import { identitySchema } from "./identity-schema.js";
import { policyError } from "./interface-policy-error.js";

const schema = z.object({
  identity: identitySchema,
  text: z.string().trim().min(1).max(8000),
  requestId: z.string().min(1).max(200),
});

export interface SupportRouteDependencies {
  auth: AuthService;
  support: PublicSupportPort;
  requests: RequestCoordinator;
  usagePolicy: UsagePolicyService;
}

export async function registerSupportRoute(
  app: FastifyInstance,
  dependencies: SupportRouteDependencies,
): Promise<void> {
  app.post("/v1/internal/support-chat", async (request, reply) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const resolved = await dependencies.auth.status(
      parsed.data.identity as SubscriberIdentity,
    );
    try {
      return await dependencies.requests.execute(
        parsed.data.identity.interfaceKind,
        parsed.data.identity.externalUserId,
        parsed.data.requestId,
        async () => {
          await dependencies.usagePolicy.assertAllowed(resolved.subscriber.id, "chat");
          const response = await dependencies.support.reply({
            subscriber: resolved.subscriber,
            text: parsed.data.text,
            requestId: parsed.data.requestId,
          });
          return {
            text: response.text,
            sources: [],
            plans: response.plans.map((plan) => ({
              productId: plan.productId,
              name: plan.name,
              price: plan.price,
              currency: plan.currency,
              billingPeriod: plan.billingPeriod,
              billingInterval: plan.billingInterval,
              purchaseUrl: plan.purchaseUrl,
            })),
          };
        },
      );
    } catch (error) {
      const known = policyError(error);
      if (known) return reply.code(known.status).send({ error: known.error });
      request.log.warn({ errorName: error instanceof Error ? error.name : "Error" });
      return reply.code(502).send({ error: "support_unavailable" });
    }
  });
}
