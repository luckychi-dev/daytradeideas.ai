import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessService } from "../domain/access-service.js";
import type { CompanionService } from "../domain/companion-service.js";
import type {
  TranscriptionProvider,
  UsageRepository,
  VisionProvider,
} from "../domain/ports.js";
import {
  RequestCoordinator,
} from "../domain/request-coordinator.js";
import type { SubscriberIdentity } from "../domain/types.js";
import { UsagePolicyService } from "../domain/usage-policy.js";
import { assessTrade } from "../risk/trade-engine.js";
import { registerConversationMediaRoutes } from "./conversation-media-routes.js";
import { identitySchema } from "./identity-schema.js";
import { policyError } from "./interface-policy-error.js";

const chatSchema = z.object({
  identity: identitySchema,
  text: z.string().min(1).max(8000),
  requestId: z.string().min(1).max(200),
});
const tradeSchema = z.object({
  identity: identitySchema,
  trade: z.object({
    direction: z.enum(["long", "short"]),
    entryPrice: z.number().positive(),
    stopPrice: z.number().positive(),
    targetPrices: z.array(z.number().positive()).min(1).max(3),
    riskAllowance: z.number().positive(),
    monetaryLossPerUnitAtStop: z.number().positive(),
    positionUnitIncrement: z.number().positive(),
    plannedPositionSize: z.number().positive().optional(),
    remainingLossAllowance: z.object({
      daily: z.number().nonnegative(),
      weekly: z.number().nonnegative(),
      monthly: z.number().nonnegative(),
    }).optional(),
    stopOrderPlanned: z.boolean(),
    noTradeConditionDisclosed: z.boolean(),
  }),
});

export interface ConversationRouteDependencies {
  access: AccessService;
  companion: CompanionService;
  transcription: TranscriptionProvider;
  vision: VisionProvider;
  usage: UsageRepository;
  usagePolicy: UsagePolicyService;
  transcriptionProvider: string;
  transcriptionCostPerSecond: number;
  visionInputCostPerMillionUsd: number;
  visionOutputCostPerMillionUsd: number;
  requests: RequestCoordinator;
}

export async function registerConversationRoutes(
  app: FastifyInstance,
  deps: ConversationRouteDependencies,
): Promise<void> {
  app.post("/v1/internal/chat", async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await deps.access.authorize(
      parsed.data.identity as SubscriberIdentity,
    );
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    try {
      return await deps.requests.execute(
        parsed.data.identity.interfaceKind,
        parsed.data.identity.externalUserId,
        parsed.data.requestId,
        async () => {
          await deps.usagePolicy.assertAllowed(subscriber.id, "chat");
          const response = await deps.companion.reply({
            subscriber,
            text: parsed.data.text,
            requestId: parsed.data.requestId,
          });
          return {
            text: response.text,
            sources: response.sources.map((source) => ({
              sourceId: source.sourceId,
              sourceTitle: source.sourceTitle,
              sourceVersion: source.sourceVersion,
              locator: source.locator,
            })),
          };
        },
      );
    } catch (error) {
      const known = policyError(error);
      if (known) return reply.code(known.status).send({ error: known.error });
      request.log.warn({ errorName: error instanceof Error ? error.name : "Error" });
      return reply.code(502).send({ error: "mentor_unavailable" });
    }
  });

  await registerConversationMediaRoutes(app, deps);

  app.post("/v1/internal/risk-assess", async (request, reply) => {
    const parsed = tradeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await deps.access.authorize(
      parsed.data.identity as SubscriberIdentity,
    );
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    const trade = parsed.data.trade;
    const { plannedPositionSize, remainingLossAllowance, ...requiredTrade } = trade;
    return assessTrade({
      ...requiredTrade,
      ...(plannedPositionSize !== undefined ? { plannedPositionSize } : {}),
      ...(remainingLossAllowance !== undefined ? { remainingLossAllowance } : {}),
    });
  });
}
