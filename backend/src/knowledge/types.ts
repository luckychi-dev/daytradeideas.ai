export type ApprovalStatus =
  | "ingested"
  | "extracted"
  | "attribution_checked"
  | "validation_required"
  | "approved"
  | "restricted"
  | "superseded"
  | "rejected";

export type RetrievalPermission =
  | "admin_only"
  | "production_teaching"
  | "historical_examples_only"
  | "excluded";

export type AuthorityLayer = "A" | "B" | "C" | "D" | "E" | "F";

export interface PlannedSource {
  key: string;
  relativePath: string;
  title: string;
  version: string;
  moduleCode: string;
  authorOrSpeaker: string;
  authorityLayer: AuthorityLayer;
  approvalStatus: ApprovalStatus;
  retrievalPermission: RetrievalPermission;
  contentType: string;
  topicTags: string[];
  kind: "docx" | "text" | "canonical-rules";
}

export interface KnowledgeChunkDraft {
  chunkIndex: number;
  locator: string;
  content: string;
  authorityLayer: AuthorityLayer;
  approvalStatus: ApprovalStatus;
  retrievalPermission: RetrievalPermission;
  contentType: string;
  topicTags: string[];
  ruleIds: string[];
  metadata: Record<string, unknown>;
}
