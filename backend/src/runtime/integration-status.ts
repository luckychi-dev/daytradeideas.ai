import type { AppConfig } from "../config.js";

export function createIntegrationStatus(
  config: AppConfig,
  mcpConfigured: boolean,
): () => Promise<Record<string, unknown>> {
  return async () => ({
    deepseekConfigured: Boolean(config.DEEPSEEK_API_KEY),
    deepseekModel: config.DEEPSEEK_MODEL,
    xaiVoiceConfigured: Boolean(config.XAI_API_KEY),
    xaiManagementConfigured: Boolean(
      config.XAI_MANAGEMENT_KEY && config.XAI_TEAM_ID,
    ),
    openAiFallbackConfigured: Boolean(config.OPENAI_API_KEY),
    voiceProvider: config.VOICE_TRANSCRIPTION_PROVIDER,
    voiceOutputConfigured: config.VOICE_OUTPUT_PROVIDER === "chatterbox",
    voiceOutputProvider: config.VOICE_OUTPUT_PROVIDER,
    voiceOutputVoice: config.CHATTERBOX_VOICE_ID,
    xaiVisionConfigured: Boolean(config.XAI_API_KEY),
    xaiVisionModel: config.XAI_VISION_MODEL,
    wordpressBridgeConfigured: Boolean(config.WORDPRESS_BRIDGE_SECRET),
    wordpressBridgeUrl: config.WORDPRESS_BRIDGE_URL,
    telegramAllowlistCount: config.TELEGRAM_ALLOWED_USER_IDS.length,
    mcpConnectorConfigured: Boolean(mcpConfigured),
    mcpConnectorUrl: config.MCP_SERVER_URL,
  });
}
