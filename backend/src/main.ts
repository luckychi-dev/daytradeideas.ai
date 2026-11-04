import "./env-file.js";
import { AllowlistPolicy } from "./adapters/access/allowlist-policy.js";
import { createTranscriptionProvider } from "./adapters/audio/create-transcription.js";
import { createSpeechProvider } from "./adapters/audio/create-speech.js";
import { DeepSeekModel } from "./adapters/model/deepseek-model.js";
import { DeepSeekTradeExtractor } from "./adapters/model/deepseek-trade-extractor.js";
import { XaiVisionProvider } from "./adapters/vision/xai-vision.js";
import { XaiBillingClient } from "./adapters/xai/xai-billing.js";
import { LocalKnowledgeFileReader } from "./adapters/knowledge/knowledge-file-reader.js";
import { PostgresAdminRepository } from "./adapters/postgres/admin-repository.js";
import { PostgresAnswerAuditRepository } from "./adapters/postgres/answer-audit-repository.js";
import { PostgresAuthSessionRepository } from "./adapters/postgres/auth-session-repository.js";
import { PostgresConversationRepository } from "./adapters/postgres/conversation-repository.js";
import { PostgresKnowledgeRepository } from "./adapters/postgres/knowledge-repository.js";
import { PostgresKnowledgeAdminRepository } from "./adapters/postgres/knowledge-admin-repository.js";
import { PostgresIdempotencyRepository } from "./adapters/postgres/idempotency-repository.js";
import { PostgresFeedbackRepository } from "./adapters/postgres/feedback-repository.js";
import { PostgresMemoryRepository } from "./adapters/postgres/memory-repository.js";
import { PostgresRuntimeSettingsRepository } from "./adapters/postgres/runtime-settings-repository.js";
import { PostgresRetentionRepository } from "./adapters/postgres/retention-repository.js";
import { PostgresSubscriberRepository } from "./adapters/postgres/subscriber-repository.js";
import { PostgresSubscriptionEventRepository } from "./adapters/postgres/subscription-event-repository.js";
import { PostgresUsageRepository } from "./adapters/postgres/usage-repository.js";
import { PostgresVerificationRateLimitRepository } from "./adapters/postgres/verification-rate-limit-repository.js";
import { WordPressBridgeClient } from "./adapters/wordpress/wordpress-bridge-client.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/database.js";
import { AccessService } from "./domain/access-service.js";
import { KnowledgeAdminService } from "./domain/admin-knowledge-service.js";
import { AuthService } from "./domain/auth-service.js";
import { CompanionService } from "./domain/companion-service.js";
import { PublicSupportService } from "./domain/public-support-service.js";
import { RequestCoordinator } from "./domain/request-coordinator.js";
import { SubscriptionReconciler } from "./domain/subscription-reconciler.js";
import { RetentionService } from "./domain/retention-service.js";
import { TradeAssessmentService } from "./domain/trade-assessment-service.js";
import { UsagePolicyService } from "./domain/usage-policy.js";
import { createMcpConnector } from "./mcp/create-connector.js";
import { installShutdown, startPeriodicJobs } from "./runtime/periodic-jobs.js";
import { createIntegrationStatus } from "./runtime/integration-status.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const adminRepository = new PostgresAdminRepository(pool);
const knowledgeRetriever = new PostgresKnowledgeRepository(pool);
const knowledgeAdmin = new KnowledgeAdminService(
  new PostgresKnowledgeAdminRepository(pool),
  new LocalKnowledgeFileReader(),
);
const subscribers = new PostgresSubscriberRepository(pool);
const usage = new PostgresUsageRepository(pool);
const runtimeSettings = new PostgresRuntimeSettingsRepository(pool);
const memory = new PostgresMemoryRepository(pool);
const feedback = new PostgresFeedbackRepository(pool);
const wordpressBridge = new WordPressBridgeClient({
  baseUrl: config.WORDPRESS_BRIDGE_URL,
  ...(config.WORDPRESS_BRIDGE_SECRET
    ? { secret: config.WORDPRESS_BRIDGE_SECRET }
    : {}),
});
const auth = new AuthService(
  subscribers,
  new PostgresAuthSessionRepository(pool),
  wordpressBridge,
);
const subscriptionReconciler = new SubscriptionReconciler(subscribers, wordpressBridge);
const retention = new RetentionService(
  runtimeSettings,
  new PostgresRetentionRepository(pool),
);
const access = new AccessService(
  new AllowlistPolicy(config.TELEGRAM_ALLOWED_USER_IDS),
  subscribers,
);
const conversations = new PostgresConversationRepository(pool);
const model = new DeepSeekModel({
  apiKey: config.DEEPSEEK_API_KEY,
  baseURL: config.DEEPSEEK_BASE_URL,
  model: config.DEEPSEEK_MODEL,
});
const usagePolicy = new UsagePolicyService(runtimeSettings, usage);
const companion = new CompanionService(
  conversations,
  knowledgeRetriever,
  model,
  usage,
  {
    historyLimit: config.CONVERSATION_HISTORY_LIMIT,
    knowledgeLimit: config.KNOWLEDGE_RESULT_LIMIT,
    maxOutputTokens: config.MODEL_MAX_OUTPUT_TOKENS,
    provider: "deepseek",
    inputCostPerMillionUsd: config.DEEPSEEK_INPUT_COST_PER_MTOK,
    outputCostPerMillionUsd: config.DEEPSEEK_OUTPUT_COST_PER_MTOK,
    knowledgeVersion: config.KNOWLEDGE_VERSION,
  },
  new PostgresAnswerAuditRepository(pool),
  new TradeAssessmentService(
    new DeepSeekTradeExtractor({
      apiKey: config.DEEPSEEK_API_KEY,
      baseURL: config.DEEPSEEK_BASE_URL,
      model: config.DEEPSEEK_MODEL,
    }),
    runtimeSettings,
  ),
  memory,
);
const support = new PublicSupportService(
  conversations,
  model,
  usage,
  wordpressBridge,
  {
    historyLimit: config.CONVERSATION_HISTORY_LIMIT,
    maxOutputTokens: config.MODEL_MAX_OUTPUT_TOKENS,
    provider: "deepseek",
    inputCostPerMillionUsd: config.DEEPSEEK_INPUT_COST_PER_MTOK,
    outputCostPerMillionUsd: config.DEEPSEEK_OUTPUT_COST_PER_MTOK,
  },
);
const mcp = createMcpConnector({
  pool,
  config,
  admin: adminRepository,
  knowledgeAdmin,
  knowledgeRetriever,
});
const app = buildServer({
  pool,
  adminRepository,
  knowledgeAdmin,
  knowledgeRetriever,
  adminToken: config.ADMIN_API_TOKEN,
  access,
  auth,
  companion,
  support,
  events: new PostgresSubscriptionEventRepository(pool),
  transcription: createTranscriptionProvider(config),
  vision: new XaiVisionProvider({
    ...(config.XAI_API_KEY ? { apiKey: config.XAI_API_KEY } : {}),
    baseURL: config.XAI_BASE_URL,
    model: config.XAI_VISION_MODEL,
  }),
  usage,
  usagePolicy,
  transcriptionProvider: config.VOICE_TRANSCRIPTION_PROVIDER === "xai" ? "xai" : "openai",
  transcriptionCostPerSecond:
    config.VOICE_TRANSCRIPTION_PROVIDER === "xai"
      ? config.XAI_STT_COST_PER_HOUR / 3600
      : config.OPENAI_STT_COST_PER_MINUTE / 60,
  visionInputCostPerMillionUsd: config.XAI_VISION_INPUT_COST_PER_MTOK,
  visionOutputCostPerMillionUsd: config.XAI_VISION_OUTPUT_COST_PER_MTOK,
  speech: createSpeechProvider(config),
  speechCostPerThousandChars: config.CHATTERBOX_TTS_COST_PER_1K_CHARS,
  requests: new RequestCoordinator(new PostgresIdempotencyRepository(pool)),
  runtimeSettings,
  subscriptionReconciler,
  memory,
  retention,
  integrationStatus: createIntegrationStatus(config, Boolean(mcp)),
  feedback,
  xaiBilling: new XaiBillingClient({
    ...(config.XAI_MANAGEMENT_KEY
      ? { managementKey: config.XAI_MANAGEMENT_KEY }
      : {}),
    ...(config.XAI_TEAM_ID ? { teamId: config.XAI_TEAM_ID } : {}),
    baseURL: config.XAI_MANAGEMENT_BASE_URL,
  }),
  verificationRateLimits: new PostgresVerificationRateLimitRepository(pool),
  serviceToken: config.INTERFACE_SERVICE_TOKEN,
  ...(config.WORDPRESS_BRIDGE_SECRET
    ? { wordpressBridgeSecret: config.WORDPRESS_BRIDGE_SECRET }
    : {}),
  ...(mcp ? { mcp } : {}),
});

installShutdown(app, pool);
await app.listen({ host: config.HOST, port: config.PORT });
startPeriodicJobs(
  subscriptionReconciler,
  retention,
  config.SUBSCRIPTION_RECONCILE_INTERVAL_MINUTES,
);
