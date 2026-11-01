import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { AccessService } from "./domain/access-service.js";
import type { AdminRepository, XaiBillingPort } from "./domain/admin-ports.js";
import type { AuthService } from "./domain/auth-service.js";
import type { CompanionService } from "./domain/companion-service.js";
import type { PublicSupportPort } from "./domain/public-support-service.js";
import type {
  SubscriptionEventRepository,
  TranscriptionProvider,
  UsageRepository,
  VerificationRateLimitRepository,
  VisionProvider,
} from "./domain/ports.js";
import type { UsagePolicyService } from "./domain/usage-policy.js";
import type { RuntimeSettingsRepository } from "./domain/ports.js";
import type { MemoryRepository } from "./domain/memory-ports.js";
import type { FeedbackRepository } from "./domain/feedback-ports.js";
import { KnowledgeAdminService } from "./domain/admin-knowledge-service.js";
import { LocalKnowledgeFileReader } from "./adapters/knowledge/knowledge-file-reader.js";
import { PostgresKnowledgeAdminRepository } from "./adapters/postgres/knowledge-admin-repository.js";
import { registerAdminRoutes } from "./http/admin-route.js";
import type { RequestCoordinator } from "./domain/request-coordinator.js";
import type { SubscriptionReconciler } from "./domain/subscription-reconciler.js";
import type { RetentionService } from "./domain/retention-service.js";
import { registerHealthRoutes } from "./http/health-route.js";
import { registerInterfaceRoutes } from "./http/interface-route.js";
import { registerRawJsonBody } from "./http/raw-body.js";
import { registerWordPressEventRoute } from "./http/wordpress-event-route.js";

export interface ServerDependencies {
  pool: Pool;
  adminRepository: AdminRepository;
  adminToken: string;
  access: AccessService;
  auth: AuthService;
  companion: CompanionService;
  support: PublicSupportPort;
  events: SubscriptionEventRepository;
  transcription: TranscriptionProvider;
  vision: VisionProvider;
  usage: UsageRepository;
  usagePolicy: UsagePolicyService;
  transcriptionProvider: string;
  transcriptionCostPerSecond: number;
  visionInputCostPerMillionUsd: number;
  visionOutputCostPerMillionUsd: number;
  requests: RequestCoordinator;
  runtimeSettings: RuntimeSettingsRepository;
  subscriptionReconciler: SubscriptionReconciler;
  memory: MemoryRepository;
  retention: RetentionService;
  integrationStatus: () => Promise<Record<string, unknown>>;
  feedback: FeedbackRepository;
  xaiBilling: XaiBillingPort;
  serviceToken: string;
  wordpressBridgeSecret?: string;
  verificationRateLimits: VerificationRateLimitRepository;
}

export function buildServer(dependencies: ServerDependencies): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: [
        "req.headers.authorization",
        "req.headers.x-service-token",
        "req.headers.x-admin-token",
        "*.apiKey",
        "*.token",
      ],
    },
    bodyLimit: 64 * 1024,
  });

  registerRawJsonBody(app);
  app.register(async (instance) => {
    await registerAdminRoutes(instance, {
      adminToken: dependencies.adminToken,
      repository: dependencies.adminRepository,
      settings: dependencies.runtimeSettings,
      reconciler: dependencies.subscriptionReconciler,
      retention: dependencies.retention,
      integrationStatus: dependencies.integrationStatus,
      feedback: dependencies.feedback,
      xaiBilling: dependencies.xaiBilling,
      knowledgeAdmin: new KnowledgeAdminService(
        new PostgresKnowledgeAdminRepository(dependencies.pool),
        new LocalKnowledgeFileReader(),
      ),
    });
  });
  app.register(async (instance) => {
    await registerHealthRoutes(instance, dependencies.pool);
  });
  app.register(async (instance) => {
    await registerInterfaceRoutes(instance, {
      access: dependencies.access,
      auth: dependencies.auth,
      companion: dependencies.companion,
      support: dependencies.support,
      transcription: dependencies.transcription,
      vision: dependencies.vision,
      usage: dependencies.usage,
      usagePolicy: dependencies.usagePolicy,
      transcriptionProvider: dependencies.transcriptionProvider,
      transcriptionCostPerSecond: dependencies.transcriptionCostPerSecond,
      visionInputCostPerMillionUsd: dependencies.visionInputCostPerMillionUsd,
      visionOutputCostPerMillionUsd: dependencies.visionOutputCostPerMillionUsd,
      requests: dependencies.requests,
      serviceToken: dependencies.serviceToken,
      memory: dependencies.memory,
      feedback: dependencies.feedback,
      rateLimits: dependencies.verificationRateLimits,
    });
  });
  app.register(async (instance) => {
    await registerWordPressEventRoute(
      instance,
      dependencies.events,
      dependencies.wordpressBridgeSecret,
    );
  });
  return app;
}
