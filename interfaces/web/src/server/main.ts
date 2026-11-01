import "./env-file.js";
import { fileURLToPath } from "node:url";
import { WebBackendClient } from "./backend-client.js";
import { AuthRateLimiter } from "./auth-rate-limit.js";
import { loadWebConfig } from "./config.js";
import { buildWebServer } from "./server.js";

const config = loadWebConfig();
const staticRoot = fileURLToPath(new URL("../client", import.meta.url));
const app = buildWebServer({
  backend: new WebBackendClient(config.BACKEND_URL, config.INTERFACE_SERVICE_TOKEN),
  sessionSecret: config.INTERFACE_SERVICE_TOKEN,
  secureCookie: config.NODE_ENV === "production" && config.WEB_PUBLIC_URL.startsWith("https://"),
  telegramBotUrl: config.TELEGRAM_BOT_URL,
  webPublicUrl: config.WEB_PUBLIC_URL,
  authLimiter: new AuthRateLimiter(),
  ...(config.NODE_ENV === "production" ? { staticRoot } : {}),
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down web interface.`);
  await app.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.WEB_PORT });
