export type MemoryCategory =
  | "preference"
  | "plan_setting"
  | "learning_goal"
  | "self_reported_habit";

export interface MemorySettings {
  enabled: boolean;
  consentVersion: string | null;
  consentedAt: Date | null;
}

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  origin: string;
  reviewAfter: string | null;
  updatedAt: Date;
}

