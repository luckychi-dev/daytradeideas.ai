import type { AdminRepository } from "../domain/admin-ports.js";
import type { KnowledgeAdminPort } from "../domain/admin-knowledge-ports.js";
import type {
  KnowledgeAuthorityLayer,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
} from "../domain/admin-knowledge-types.js";
import type { KnowledgeRetriever } from "../domain/ports.js";

export interface KnowledgeMutation {
  title: string;
  version: string;
  moduleCode: string;
  authorOrSpeaker: string;
  authorityLayer: KnowledgeAuthorityLayer;
  contentType: string;
  topicTags: string[];
  content: string;
}

export interface KnowledgeSummaryResult {
  id: string;
  title: string;
  version: string;
  moduleCode: string;
  authorityLayer: KnowledgeAuthorityLayer;
  chunkCount: number;
  updatedAt: string;
}

export interface KnowledgeDocumentResult extends KnowledgeSummaryResult {
  authorOrSpeaker: string | null;
  contentType: string;
  sourceFile: string | null;
  topicTags: string[];
  content: string;
  url: string;
}

function summary(value: KnowledgeDocumentSummary): KnowledgeSummaryResult {
  return {
    id: value.id,
    title: value.title,
    version: value.version,
    moduleCode: value.moduleCode,
    authorityLayer: value.authorityLayer,
    chunkCount: value.chunkCount,
    updatedAt: value.updatedAt.toISOString(),
  };
}

function document(value: KnowledgeDocument, adminUrl: string): KnowledgeDocumentResult {
  return {
    ...summary(value),
    authorOrSpeaker: value.authorOrSpeaker,
    contentType: value.contentType,
    sourceFile: value.sourceFile,
    topicTags: value.topicTags,
    content: value.content,
    url: `${adminUrl}#knowledge/${value.id}`,
  };
}

export class KnowledgeToolService {
  constructor(
    private readonly documents: KnowledgeAdminPort,
    private readonly retrieval: KnowledgeRetriever,
    private readonly admin: AdminRepository,
    private readonly adminUrl: string,
  ) {}

  async list(actor: string): Promise<KnowledgeSummaryResult[]> {
    await this.audit(actor, "mcp.knowledge.listed", null);
    return (await this.documents.list()).map(summary);
  }

  async search(actor: string, query: string, limit: number) {
    await this.audit(actor, "mcp.knowledge.searched", null, { query, limit });
    const hits = await this.retrieval.search(query, limit);
    const unique = new Map<string, {
      id: string;
      title: string;
      text: string;
      url: string;
    }>();
    for (const hit of hits) {
      const existing = unique.get(hit.sourceId);
      unique.set(hit.sourceId, {
        id: hit.sourceId,
        title: `${hit.sourceTitle} (${hit.sourceVersion})`,
        text: existing ? `${existing.text}\n\n${hit.content}` : hit.content,
        url: `${this.adminUrl}#knowledge/${hit.sourceId}`,
      });
    }
    return [...unique.values()];
  }

  async fetch(actor: string, id: string): Promise<KnowledgeDocumentResult> {
    const value = await this.documents.get(id);
    await this.audit(actor, "mcp.knowledge.read", id);
    return document(value, this.adminUrl);
  }

  async create(actor: string, input: KnowledgeMutation): Promise<KnowledgeSummaryResult> {
    const value = await this.documents.create(input);
    await this.audit(actor, "mcp.knowledge.document_created", value.id, {
      title: value.title,
      version: value.version,
    });
    return summary(value);
  }

  async update(
    actor: string,
    id: string,
    input: KnowledgeMutation,
  ): Promise<KnowledgeSummaryResult> {
    const value = await this.documents.update(id, input);
    await this.audit(actor, "mcp.knowledge.document_updated", id, {
      title: value.title,
      version: value.version,
    });
    return summary(value);
  }

  async delete(actor: string, id: string, titleConfirmation: string): Promise<{ deleted: true }> {
    const value = await this.documents.get(id);
    if (value.title !== titleConfirmation.trim()) {
      throw new Error("Delete confirmation title does not match the document title.");
    }
    await this.documents.delete(id);
    await this.audit(actor, "mcp.knowledge.document_deleted", id, {
      title: value.title,
      version: value.version,
    });
    return { deleted: true };
  }

  private audit(
    actor: string,
    action: string,
    targetId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    return this.admin.audit({
      actor,
      action,
      targetType: "knowledge_source",
      targetId,
      details,
    });
  }
}
