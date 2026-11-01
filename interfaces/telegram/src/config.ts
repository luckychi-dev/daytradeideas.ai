import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  TELEGRAM_PORT: z.coerce.number().int().positive().default(3001),
  BACKEND_URL: z.string().url().default("http://localhost:3000"),
  INTERFACE_SERVICE_TOKEN: z.string().min(24),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(24),
  PUBLIC_BASE_URL: z.string().url(),
  TELEGRAM_WELCOME_IMAGE_URL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().optional(),
  ),
});

export type TelegramConfig = z.infer<typeof schema>;

export function loadTelegramConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TelegramConfig {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Telegram interface configuration: ${summary}`);
  }
  return parsed.data;
}
