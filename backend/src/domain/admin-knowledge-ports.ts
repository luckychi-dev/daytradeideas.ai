import type {
  KnowledgeDocument,
  KnowledgeDocumentInput,
  KnowledgeDocumentSummary,
  KnowledgeDocumentWrite,
  KnowledgeFileUpload,
} from "./admin-knowledge-types.js";

export interface KnowledgeAdminPort {
  list(): Promise<KnowledgeDocumentSummary[]>;
  get(id: string): Promise<KnowledgeDocument>;
  create(input: KnowledgeDocumentInput): Promise<KnowledgeDocument>;
  update(id: string, input: KnowledgeDocumentInput): Promise<KnowledgeDocument>;
  delete(id: string): Promise<void>;
}

export interface KnowledgeAdminRepository {
  listDocuments(): Promise<KnowledgeDocumentSummary[]>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  createDocument(input: KnowledgeDocumentWrite): Promise<KnowledgeDocument>;
  updateDocument(id: string, input: KnowledgeDocumentWrite): Promise<KnowledgeDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
}

export interface KnowledgeFileReader {
  extract(file: KnowledgeFileUpload): Promise<{ content: string; fileName: string }>;
}
