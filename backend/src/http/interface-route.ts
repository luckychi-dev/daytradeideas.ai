import type { FastifyInstance } from "fastify";
import type { AccessService } from "../domain/access-service.js";
import type { AuthService } from "../domain/auth-service.js";
import type { CompanionService } from "../domain/companion-service.js";
import type { PublicSupportPort } from "../domain/public-support-service.js";
import type {
  TranscriptionProvider,
  UsageRepository,
  VerificationRateLimitRepository,
  VisionProvider,
  SpeechProvider,
} from "../domain/ports.js";
import type { MemoryRepository } from "../domain/memory-ports.js";
import type { FeedbackRepository } from "../domain/feedback-ports.js";
import type { RequestCoordinator } from "../domain/request-coordinator.js";
import type { SubscriberIdentity } from "../domain/types.js";
import type { UsagePolicyService } from "../domain/usage-policy.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerConversationRoutes } from "./conversation-routes.js";
import { registerSupportRoute } from "./support-route.js";
import { registerMemoryRoutes } from "./memory-routes.js";
import { registerFeedbackRoutes } from "./feedback-routes.js";
import { accessSchema } from "./identity-schema.js";
import { secretMatches } from "./service-auth.js";

export interface InterfaceRouteDependencies {
  access: AccessService;
  auth: AuthService;
  companion: CompanionService;
  support: PublicSupportPort;
  transcription: TranscriptionProvider;
  vision: VisionProvider;
  usage: UsageRepository;
  usagePolicy: UsagePolicyService;
  transcriptionProvider: string;
  transcriptionCostPerSecond: number;
  visionInputCostPerMillionUsd: number;
  visionOutputCostPerMillionUsd: number;
  speech?: SpeechProvider | undefined;
  speechCostPerThousandChars: number;
  requests: RequestCoordinator;
  serviceToken: string;
  memory: MemoryRepository;
  feedback: FeedbackRepository;
  rateLimits: VerificationRateLimitRepository;
}

export async function registerInterfaceRoutes(
  app: FastifyInstance,
  dependencies: InterfaceRouteDependencies,
): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/internal/")) return;
    const supplied = request.headers["x-service-token"];
    const token = Array.isArray(supplied) ? supplied[0] : supplied;
    if (!secretMatches(token, dependencies.serviceToken)) {
      await reply.code(401).send({ error: "unauthorized_interface" });
    }
  });

  app.post("/v1/internal/access", async (request, reply) => {
    const parsed = accessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await dependencies.access.authorize(
      parsed.data.identity as SubscriberIdentity,
    );
    return subscriber
      ? { allowed: true, subscriberId: subscriber.id }
      : { allowed: false, authRequired: true };
  });

  await registerAuthRoutes(
    app,
    dependencies.access,
    dependencies.auth,
    dependencies.rateLimits,
  );
  await registerSupportRoute(app, dependencies);
  await registerMemoryRoutes(app, dependencies.access, dependencies.memory);
  await registerFeedbackRoutes(app, dependencies.access, dependencies.feedback);
  await registerConversationRoutes(app, dependencies);
}
