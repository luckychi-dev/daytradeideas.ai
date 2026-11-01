import { describe, expect, it, vi } from "vitest";
import type { IdempotencyRepository } from "./idempotency-ports.js";
import { RequestCoordinator } from "./request-coordinator.js";

function repository() {
  let cached: unknown;
  let status: "new" | "completed" = "new";
  const implementation: IdempotencyRepository = {
    begin: async () => status === "completed"
      ? { status, response: cached }
      : { status: "new" },
    complete: async (_kind, _user, _request, response) => {
      cached = response;
      status = "completed";
    },
    fail: async () => {
      status = "new";
      cached = undefined;
    },
  };
  return implementation;
}

describe("RequestCoordinator", () => {
  it("executes a request once and returns its cached response", async () => {
    const coordinator = new RequestCoordinator(repository());
    const task = vi.fn(async () => ({ text: "answer" }));
    const first = await coordinator.execute("telegram", "123", "update-1", task);
    const second = await coordinator.execute("telegram", "123", "update-1", task);
    expect(first).toEqual(second);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("releases a failed request so a retry can run", async () => {
    const coordinator = new RequestCoordinator(repository());
    await expect(coordinator.execute(
      "telegram",
      "123",
      "update-2",
      async () => { throw new Error("provider failed"); },
    )).rejects.toThrow("provider failed");
    await expect(coordinator.execute(
      "telegram",
      "123",
      "update-2",
      async () => ({ ok: true }),
    )).resolves.toEqual({ ok: true });
  });
});

