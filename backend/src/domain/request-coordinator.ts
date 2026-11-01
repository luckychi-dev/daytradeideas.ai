import type { IdempotencyRepository } from "./idempotency-ports.js";

export class RequestInProgressError extends Error {}

class KeyedSerialQueue {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(key, current);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === current) this.tails.delete(key);
    }
  }
}

export class RequestCoordinator {
  private readonly queue = new KeyedSerialQueue();

  constructor(private readonly repository: IdempotencyRepository) {}

  execute<T>(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    return this.queue.run(`${interfaceKind}:${externalUserId}`, async () => {
      const state = await this.repository.begin(interfaceKind, externalUserId, requestId);
      if (state.status === "completed") return state.response as T;
      if (state.status === "processing") throw new RequestInProgressError();
      try {
        const response = await task();
        await this.repository.complete(interfaceKind, externalUserId, requestId, response);
        return response;
      } catch (error) {
        await this.repository.fail(interfaceKind, externalUserId, requestId);
        throw error;
      }
    });
  }
}

