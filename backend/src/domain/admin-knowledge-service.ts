import { createHash } from "node:crypto";
import { chunkParagraphs } from "../knowledge/chunker.js";
import type { PlannedSource } from "../knowledge/types.js";
import type {
  KnowledgeAdminPort,
  KnowledgeAdminRepository,
  KnowledgeFileReader,
} from "./admin-knowledge-ports.js";
import type {
  KnowledgeDocument,
  KnowledgeDocumentInput,
  KnowledgeDocumentSummary,
  KnowledgeDocumentWrite,
} from "./admin-knowledge-types.js";

const MAX_CONTENT_CHARS = 2_000_000;

export class KnowledgeInputError extends Error {}
export class KnowledgeDocumentNotFoundError extends Error {}
export class KnowledgeDocumentConflictError extends Error {}

function clean(value: string): string {
  return value.trim();
}

function paragraphs(content: string): string[] {
  return content
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function defaultText(value: string): string {
  return value.length > 0 ? value : "knowledge";
}

export class KnowledgeAdminService implements KnowledgeAdminPort {
  constructor(
    private readonly repository: KnowledgeAdminRepository,
    private readonly files: KnowledgeFileReader,
  ) {}

  list(): Promise<KnowledgeDocumentSummary[]> {
    return this.repository.listDocuments();
  }

  async get(id: string): Promise<KnowledgeDocument> {
    const document = await this.repository.getDocument(id);
    if (!document) throw new KnowledgeDocumentNotFoundError();
    return document;
  }

  async create(input: KnowledgeDocumentInput): Promise<KnowledgeDocument> {
    return this.repository.createDocument(await this.toWrite(input));
  }

  async update(id: string, input: KnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const document = await this.repository.updateDocument(id, await this.toWrite(input));
    if (!document) throw new KnowledgeDocumentNotFoundError();
    return document;
  }

  async delete(id: string): Promise<void> {
    if (!await this.repository.deleteDocument(id)) {
      throw new KnowledgeDocumentNotFoundError();
    }
  }

  private async toWrite(input: KnowledgeDocumentInput): Promise<KnowledgeDocumentWrite> {
    const extracted = input.file ? await this.files.extract(input.file) : null;
    const content = clean(extracted?.content ?? input.content ?? "");
    const title = clean(input.title);
    const version = clean(input.version);
    if (!title || !version) {
      throw new KnowledgeInputError("Title and version are required.");
    }
    if (!content) throw new KnowledgeInputError("Knowledge content is empty.");
    if (content.length > MAX_CONTENT_CHARS) {
      throw new KnowledgeInputError("Knowledge content is too large.");
    }
    const sourceFile = clean(extracted?.fileName ?? `${title}.txt`);
    const topicTags = [...new Set(input.topicTags.map(clean).filter(Boolean))].slice(0, 20);
    const source: PlannedSource = {
      key: `managed:${title}:${version}`,
      relativePath: sourceFile,
      title,
      version,
      moduleCode: defaultText(clean(input.moduleCode)),
      authorOrSpeaker: defaultText(clean(input.authorOrSpeaker)),
      authorityLayer: input.authorityLayer,
      approvalStatus: "approved",
      retrievalPermission: "production_teaching",
      contentType: defaultText(clean(input.contentType)),
      topicTags,
      kind: "docx",
    };
    const chunks = chunkParagraphs(paragraphs(content), source);
    if (chunks.length === 0) throw new KnowledgeInputError("Knowledge content is empty.");
    return {
      title,
      version,
      moduleCode: source.moduleCode,
      authorOrSpeaker: source.authorOrSpeaker,
      authorityLayer: source.authorityLayer,
      contentType: source.contentType,
      topicTags,
      content,
      sourceFile,
      contentHash: createHash("sha256").update(content).digest("hex"),
      chunks,
    };
  }
}
