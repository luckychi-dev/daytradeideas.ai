import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { SpeechUnavailableError } from "../adapters/audio/speech-errors.js";
import { AccessService } from "../domain/access-service.js";
import type { SpeechProvider, UsageRepository } from "../domain/ports.js";
import type { Subscriber } from "../domain/types.js";
import { UsagePolicyService } from "../domain/usage-policy.js";
import { registerSpeechRoute } from "./speech-route.js";

const subscriber: Subscriber = {
  id: "subscriber-a",
  interfaceKind: "web",
  externalUserId: "visitor-a",
  displayName: "Subscriber",
  status: "active",
  verifiedEmail: "member@example.com",
  wordpressUserId: 42,
  membershipStatus: "wcm-active",
  accessExpiresAt: null,
  lastVerifiedAt: new Date(),
};

function usage(): UsageRepository {
  return {
    record: vi.fn(async () => {}),
    monthlySpendUsd: async () => 0,
    dailyUsage: async () => ({ requests: 60, voiceSeconds: 10 }),
  };
}

function policy(usageRepository: UsageRepository): UsagePolicyService {
  return new UsagePolicyService(
    {
      get: async () => ({
        monthlyBudgetUsd: 20,
        dailyMessagesPerSubscriber: 60,
        dailyVoiceSecondsPerSubscriber: 600,
        tradeAssessmentEnabled: true,
        memoryEnabled: false,
        messageRetentionDays: 365,
      }),
      update: async () => {},
    },
    usageRepository,
  );
}

function access(): AccessService {
  return new AccessService(
    { isAllowed: () => true },
    { activate: async () => subscriber, findActive: async () => subscriber },
  );
}

describe("internal speech route", () => {
  it("returns Jason audio and records output usage", async () => {
    const app = Fastify();
    const usageRepository = usage();
    const speech: SpeechProvider = {
      synthesize: async () => ({
        audio: new Uint8Array([79, 103, 103, 83]),
        mimeType: "audio/ogg",
        model: "chatterbox-opus",
        voiceId: "Jason Sen 01",
      }),
    };
    await registerSpeechRoute(app, {
      access: access(),
      speech,
      usage: usageRepository,
      usagePolicy: policy(usageRepository),
      speechCostPerThousandChars: 0,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/speech",
      payload: {
        identity: { interfaceKind: "web", externalUserId: "visitor-a" },
        text: "Use defined risk and a stop order.",
        requestId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      audioBase64: "T2dnUw==",
      mimeType: "audio/ogg",
      voiceId: "Jason Sen 01",
    });
    expect(usageRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      usageType: "synthesis",
      requestId: "voice-1-synthesis",
    }));
    await app.close();
  });

  it("reports unavailable output without failing text chat", async () => {
    const app = Fastify();
    const usageRepository = usage();
    await registerSpeechRoute(app, {
      access: access(),
      speech: {
        synthesize: async () => {
          throw new SpeechUnavailableError();
        },
      },
      usage: usageRepository,
      usagePolicy: policy(usageRepository),
      speechCostPerThousandChars: 0,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/speech",
      payload: {
        identity: { interfaceKind: "web", externalUserId: "visitor-a" },
        text: "Hello",
        requestId: "voice-2",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "voice_output_unavailable" });
    await app.close();
  });

  it("does not synthesize for an unauthorised subscriber", async () => {
    const app = Fastify();
    const usageRepository = usage();
    const synthesize = vi.fn(async () => ({
      audio: new Uint8Array([1]),
      mimeType: "audio/ogg",
      model: "chatterbox-opus",
      voiceId: "Jason Sen 01",
    }));
    await registerSpeechRoute(app, {
      access: new AccessService(
        { isAllowed: () => false },
        { activate: async () => subscriber, findActive: async () => null },
      ),
      speech: { synthesize },
      usage: usageRepository,
      usagePolicy: policy(usageRepository),
      speechCostPerThousandChars: 0,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/speech",
      payload: {
        identity: { interfaceKind: "web", externalUserId: "other-user" },
        text: "Hello",
        requestId: "voice-3",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(synthesize).not.toHaveBeenCalled();
    await app.close();
  });
});
