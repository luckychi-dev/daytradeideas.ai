import type { KnowledgeChunkDraft } from "../knowledge/types.js";

export type KnowledgeAuthorityLayer = "A" | "B" | "C" | "D" | "E" | "F";

export interface KnowledgeFileUpload {
  fileName: string;
  mimeType: string;
  base64: string;
}

export interface KnowledgeDocumentInput {
  title: string;
  version: string;
  moduleCode: string;
  authorOrSpeaker: string;
  authorityLayer: KnowledgeAuthorityLayer;
  contentType: string;
  topicTags: string[];
  content?: string | undefined;
  file?: KnowledgeFileUpload | undefined;
}

export interface KnowledgeDocumentWrite {
  title: string;
  version: string;
  moduleCode: string;
  authorOrSpeaker: string;
  authorityLayer: KnowledgeAuthorityLayer;
  contentType: string;
  topicTags: string[];
  content: string;
  sourceFile: string;
  contentHash: string;
  chunks: KnowledgeChunkDraft[];
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  version: string;
  moduleCode: string;
  authorOrSpeaker: string | null;
  authorityLayer: KnowledgeAuthorityLayer;
  contentType: string;
  approvalStatus: string;
  chunkCount: number;
  contentLength: number;
  sourceFile: string | null;
  updatedAt: Date;
}

export interface KnowledgeDocument extends KnowledgeDocumentSummary {
  content: string;
  topicTags: string[];
}
