import type {
  MemoryCategory,
  MemoryItem,
  MemorySettings,
} from "./memory-types.js";

export interface MemoryRepository {
  settings(subscriberId: string): Promise<MemorySettings>;
  enable(subscriberId: string, consentVersion: string): Promise<void>;
  disable(subscriberId: string): Promise<void>;
  items(subscriberId: string): Promise<MemoryItem[]>;
  upsert(input: {
    id?: string;
    subscriberId: string;
    category: MemoryCategory;
    content: string;
    origin: string;
    reviewAfter: string | null;
  }): Promise<MemoryItem>;
  removeItem(subscriberId: string, id: string): Promise<void>;
  clear(subscriberId: string): Promise<void>;
  activeContext(subscriberId: string): Promise<string | null>;
}

