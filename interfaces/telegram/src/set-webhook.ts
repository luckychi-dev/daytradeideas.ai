import "./env-file.js";
import { loadTelegramConfig } from "./config.js";
import { TelegramClient } from "./client.js";

const config = loadTelegramConfig();
const client = new TelegramClient(config.TELEGRAM_BOT_TOKEN);
const baseUrl = config.PUBLIC_BASE_URL.replace(/\/+$/, "");

await client.setWebhook(
  `${baseUrl}/webhooks/telegram`,
  config.TELEGRAM_WEBHOOK_SECRET,
);
console.info(`Telegram webhook registered at ${baseUrl}/webhooks/telegram`);
