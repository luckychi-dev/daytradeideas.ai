import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { SubscriptionEventRepository } from "../domain/ports.js";
import { registerRawJsonBody } from "./raw-body.js";
import { registerWordPressEventRoute } from "./wordpress-event-route.js";

const secret = "s".repeat(32);
const payload = {
  event_id: "0d4a550f-4e31-4e33-a3d2-725630863817",
  event_type: "membership_status_changed",
  wordpress_user_id: 42,
  active: true,
  active_memberships: [{
    id: 1,
    plan_id: 2,
    status: "wcm-active",
    end_date: null,
  }],
  occurred_at: new Date().toISOString(),
};

function signature(timestamp: string, nonce: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${nonce}\n${body}`)
    .digest("hex");
}

describe("WordPress membership events", () => {
  it("accepts a correctly signed event", async () => {
    const apply = vi.fn<SubscriptionEventRepository["apply"]>(async () => {});
    const app = Fastify();
    registerRawJsonBody(app);
    await registerWordPressEventRoute(app, { apply }, secret);
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce-value-123456789";
    const response = await app.inject({
      method: "POST",
      url: "/v1/integrations/wordpress/membership",
      headers: {
        "content-type": "application/json",
        "x-dtiai-timestamp": timestamp,
        "x-dtiai-nonce": nonce,
        "x-dtiai-signature": signature(timestamp, nonce, body),
      },
      payload: body,
    });
    expect(response.statusCode).toBe(202);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      wordpressUserId: 42,
      active: true,
    }));
  });

  it("accepts PHP ISO timestamps with a UTC offset", async () => {
    const apply = vi.fn<SubscriptionEventRepository["apply"]>(async () => {});
    const app = Fastify();
    registerRawJsonBody(app);
    await registerWordPressEventRoute(app, { apply }, secret);
    const body = JSON.stringify({
      ...payload,
      occurred_at: "2026-10-31T12:30:41+00:00",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce-value-987654321";
    const response = await app.inject({
      method: "POST",
      url: "/v1/integrations/wordpress/membership",
      headers: {
        "content-type": "application/json",
        "x-dtiai-timestamp": timestamp,
        "x-dtiai-nonce": nonce,
        "x-dtiai-signature": signature(timestamp, nonce, body),
      },
      payload: body,
    });
    expect(response.statusCode).toBe(202);
    expect(apply).toHaveBeenCalled();
  });
});
