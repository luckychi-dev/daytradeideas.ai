import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AccessService } from "../domain/access-service.js";
import type { MemoryRepository } from "../domain/memory-ports.js";
import { registerMemoryRoutes } from "./memory-routes.js";

const subscriber = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  interfaceKind: "telegram",
  externalUserId: "123",
  displayName: "Test",
  status: "active",
  verifiedEmail: "member@example.com",
  wordpressUserId: 42,
  membershipStatus: "wcm-active",
  accessExpiresAt: null,
  lastVerifiedAt: new Date(),
};
const identity = { interfaceKind: "telegram", externalUserId: "123" };

function setup() {
  const access = { authorize: vi.fn(async () => subscriber) } as unknown as AccessService;
  const memory: MemoryRepository = {
    settings: async () => ({ enabled: true, consentVersion: "v1", consentedAt: new Date() }),
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    items: async () => [],
    upsert: vi.fn(async (input) => ({
      id: input.id ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      category: input.category,
      content: input.content,
      origin: input.origin,
      reviewAfter: input.reviewAfter,
      updatedAt: new Date(),
    })),
    removeItem: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    activeContext: async () => null,
  };
  const app = Fastify();
  const ready = registerMemoryRoutes(app, access, memory);
  return { app, ready, memory };
}

describe("memory routes", () => {
  it("returns memory only for the authorised subscriber", async () => {
    const { app, ready } = setup();
    await ready;
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/memory/status",
      payload: { identity },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ settings: { enabled: true } });
  });

  it("stores a confirmed memory item under the tenant", async () => {
    const { app, ready, memory } = setup();
    await ready;
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/memory/items",
      payload: {
        identity,
        category: "preference",
        content: "Prefers 4-hour chart examples.",
        reviewAfter: null,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(memory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      subscriberId: subscriber.id,
      origin: "subscriber_confirmed",
    }));
  });
});

