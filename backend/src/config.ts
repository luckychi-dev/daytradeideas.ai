import { z } from "zod";

const csvIds = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  INTERFACE_SERVICE_TOKEN: z.string().min(24),
  ADMIN_API_TOKEN: z.string().min(32),
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-flash"),
  DEEPSEEK_INPUT_COST_PER_MTOK: z.coerce.number().nonnegative().default(0.3),
  DEEPSEEK_OUTPUT_COST_PER_MTOK: z.coerce.number().nonnegative().default(1.2),
  MODEL_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(8000).default(1200),
  VOICE_TRANSCRIPTION_PROVIDER: z.enum(["xai", "openai"]).default("xai"),
  XAI_API_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  XAI_MANAGEMENT_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  XAI_MANAGEMENT_BASE_URL: z.string().url()
    .default("https://management-api.x.ai"),
  XAI_TEAM_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  XAI_TRANSCRIBE_MODEL: z.string().min(1).default("grok-voice-transcribe-2.0"),
  XAI_STT_COST_PER_HOUR: z.coerce.number().nonnegative().default(0.1),
  XAI_VISION_MODEL: z.string().min(1).default("grok-4.7"),
  XAI_VISION_INPUT_COST_PER_MTOK: z.coerce.number().nonnegative().default(2),
  XAI_VISION_OUTPUT_COST_PER_MTOK: z.coerce.number().nonnegative().default(6),
  OPENAI_API_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_TRANSCRIBE_MODEL: z.string().min(1).default("gpt-4o-mini-transcribe"),
  OPENAI_STT_COST_PER_MINUTE: z.coerce.number().nonnegative().default(0.003),
  WORDPRESS_BRIDGE_URL: z.string().url()
    .default("https://www.daytradeideas.co.uk/wp-json/dtiai/v1"),
  WORDPRESS_BRIDGE_SECRET: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  MCP_SERVER_URL: z.string().url()
    .default("https://api.ai.daytradeideas.co.uk/mcp"),
  MCP_AUTH_ISSUER: z.string().url()
    .default("https://api.ai.daytradeideas.co.uk"),
  MCP_ADMIN_EMAILS: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string()
      .transform((value) => value.split(",").map((email) => email.trim()).filter(Boolean))
      .pipe(z.array(z.string().email()).min(1))
      .optional(),
  ),
  MCP_ADMIN_PASSWORD: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(24).optional(),
  ),
  MCP_WEB_ADMIN_URL: z.string().url()
    .default("https://www.daytradeideas.co.uk/wp-admin/admin.php?page=dtiai-admin"),
  TELEGRAM_ALLOWED_USER_IDS: csvIds,
  CONVERSATION_HISTORY_LIMIT: z.coerce.number().int().positive().max(100).default(20),
  KNOWLEDGE_RESULT_LIMIT: z.coerce.number().int().positive().max(20).default(8),
  KNOWLEDGE_VERSION: z.string().min(1).default("release-candidate-1.0"),
  SUBSCRIPTION_RECONCILE_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(30),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${summary}`);
  }
  return parsed.data;
}
