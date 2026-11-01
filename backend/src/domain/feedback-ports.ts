export interface FeedbackRepository {
  create(input: {
    subscriberId: string;
    requestId: string | null;
    category: "helpful" | "unclear" | "incorrect" | "safety" | "other";
    message: string;
  }): Promise<void>;
  list(limit: number, offset: number): Promise<Record<string, unknown>[]>;
  updateStatus(id: string, status: "new" | "reviewing" | "resolved", note: string | null): Promise<void>;
}

