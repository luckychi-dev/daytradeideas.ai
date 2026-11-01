import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  WEB_PORT: z.coerce.number().int().positive().default(3002),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  BACKEND_URL: z.string().url().default("http://localhost:3000"),
  INTERFACE_SERVICE_TOKEN: z.string().min(24),
  TELEGRAM_BOT_URL: z.string().url().default("https://t.me/jasonsenaibot"),
});

export type WebConfig = z.infer<typeof schema>;

export function loadWebConfig(environment: NodeJS.ProcessEnv = process.env): WebConfig {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid web interface configuration: ${summary}`);
  }
  return parsed.data;
}
