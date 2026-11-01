import "./env-file.js";
import { fileURLToPath } from "node:url";
import { BackendClient } from "./backend-client.js";
import { TelegramClient } from "./client.js";
import { loadTelegramConfig } from "./config.js";
import { TelegramHandler } from "./handler.js";
import { TelegramPoller } from "./polling.js";
import { buildTelegramServer } from "./server.js";

const config = loadTelegramConfig();
const backend = new BackendClient(config.BACKEND_URL, config.INTERFACE_SERVICE_TOKEN);
const telegram = new TelegramClient(config.TELEGRAM_BOT_TOKEN);
const welcomeImagePath = fileURLToPath(
  new URL("../assets/telegram-welcome.png", import.meta.url),
);
const handler = new TelegramHandler(backend, telegram, {
  warn(data: unknown, message?: string) {
    console.warn(message ?? "Telegram interface warning", data);
  },
}, config.TELEGRAM_WELCOME_IMAGE_URL, welcomeImagePath);
const publicHost = new URL(config.PUBLIC_BASE_URL).hostname;
const poller = ["localhost", "127.0.0.1", "::1"].includes(publicHost)
  ? new TelegramPoller({
      client: telegram,
      handler,
      warn(data: unknown, message?: string) {
        console.warn(message ?? "Telegram polling warning", data);
      },
    })
  : null;
const app = buildTelegramServer(handler, config.TELEGRAM_WEBHOOK_SECRET);

async function shutdown(signal: string): Promise<void> {
  console.info(`Telegram interface received ${signal}; shutting down.`);
  poller?.stop();
  await app.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.TELEGRAM_PORT });
if (poller) {
  console.info("Telegram interface is polling because PUBLIC_BASE_URL is local.");
  void poller.start();
}
