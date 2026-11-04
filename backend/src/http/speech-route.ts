import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessService } from "../domain/access-service.js";
import type { SpeechProvider, UsageRepository } from "../domain/ports.js";
import type { SubscriberIdentity } from "../domain/types.js";
import type { UsagePolicyService } from "../domain/usage-policy.js";
import {
  SpeechGenerationError,
  SpeechUnavailableError,
} from "../adapters/audio/speech-errors.js";
import { identitySchema } from "./identity-schema.js";
import { policyError } from "./interface-policy-error.js";

const speechSchema = z.object({
  identity: identitySchema,
  requestId: z.string().min(1).max(200),
  text: z.string().trim().min(1).max(5000),
});

export interface SpeechRouteDependencies {
  access: AccessService;
  speech?: SpeechProvider | undefined;
  usage: UsageRepository;
  usagePolicy: UsagePolicyService;
  speechCostPerThousandChars: number;
}

export function estimatedSpeechSeconds(text: string): number {
  return Math.max(1, Math.ceil(text.length / 14));
}

export async function registerSpeechRoute(
  app: FastifyInstance,
  deps: SpeechRouteDependencies,
): Promise<void> {
  app.post("/v1/internal/speech", async (request, reply) => {
    const parsed = speechSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const subscriber = await deps.access.authorize(
      parsed.data.identity as SubscriberIdentity,
    );
    if (!subscriber) return reply.code(403).send({ error: "subscriber_not_allowed" });
    if (!deps.speech) {
      return reply.code(503).send({ error: "voice_output_unavailable" });
    }

    const durationSeconds = estimatedSpeechSeconds(parsed.data.text);
    try {
      await deps.usagePolicy.assertVoiceSeconds(subscriber.id, durationSeconds);
      const result = await deps.speech.synthesize(parsed.data.text);
      if (result.audio.byteLength > 8 * 1024 * 1024) {
        throw new SpeechGenerationError();
      }
      await deps.usage.record({
        subscriberId: subscriber.id,
        model: result.model,
        provider: "chatterbox",
        usageType: "synthesis",
        inputTokens: 0,
        outputTokens: 0,
        durationSeconds,
        estimatedCostUsd:
          (parsed.data.text.length / 1000) * deps.speechCostPerThousandChars,
        requestId: `${parsed.data.requestId}-synthesis`,
      });
      return {
        audioBase64: Buffer.from(result.audio).toString("base64"),
        mimeType: result.mimeType,
        model: result.model,
        voiceId: result.voiceId,
        durationSeconds,
      };
    } catch (error) {
      const known = policyError(error);
      if (known) return reply.code(known.status).send({ error: known.error });
      if (error instanceof SpeechUnavailableError) {
        return reply.code(503).send({ error: "voice_output_unavailable" });
      }
      request.log.warn({
        errorName: error instanceof Error ? error.name : "Error",
      }, "Mentor speech generation failed.");
      return reply.code(502).send({ error: "voice_generation_failed" });
    }
  });
}
