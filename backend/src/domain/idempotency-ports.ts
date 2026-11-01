export interface IdempotencySnapshot {
  status: "new" | "processing" | "completed";
  response?: unknown;
}

export interface IdempotencyRepository {
  begin(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
  ): Promise<IdempotencySnapshot>;
  complete(
    interfaceKind: string,
    externalUserId: string,
    requestId: string,
    response: unknown,
  ): Promise<void>;
  fail(interfaceKind: string, externalUserId: string, requestId: string): Promise<void>;
}

