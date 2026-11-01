import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { KnowledgeAdminPort } from "../domain/admin-knowledge-ports.js";
import {
  KnowledgeDocumentConflictError,
  KnowledgeDocumentNotFoundError,
  KnowledgeInputError,
} from "../domain/admin-knowledge-service.js";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(150).default("application/octet-stream"),
  base64: z.string().min(1).max(8_000_000).regex(/^[A-Za-z0-9+/=\r\n]+$/),
});

const documentSchema = z.object({
  title: z.string().trim().min(1).max(240),
  version: z.string().trim().min(1).max(40),
  moduleCode: z.string().trim().min(1).max(40),
  authorOrSpeaker: z.string().trim().min(1).max(160),
  authorityLayer: z.enum(["A", "B", "C", "D", "E", "F"]),
  contentType: z.string().trim().min(1).max(80),
  topicTags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  content: z.string().max(2_000_000).optional(),
  file: uploadSchema.optional(),
}).refine((value) => Boolean(value.file || value.content?.trim()), {
  message: "Provide document text or a file.",
});

const idSchema = z.string().uuid();

function errorReply(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof KnowledgeDocumentNotFoundError) {
    return reply.code(404).send({ error: "knowledge_document_not_found" });
  }
  if (error instanceof KnowledgeDocumentConflictError) {
    return reply.code(409).send({ error: "knowledge_title_version_exists" });
  }
  if (error instanceof KnowledgeInputError) {
    return reply.code(400).send({ error: "invalid_knowledge", message: error.message });
  }
  throw error;
}

export async function registerAdminKnowledgeRoutes(
  app: FastifyInstance,
  service: KnowledgeAdminPort,
  repository: AdminRepository,
): Promise<void> {
  app.get("/v1/admin/knowledge/documents", async () => ({
    data: await service.list(),
  }));

  app.get("/v1/admin/knowledge/documents/:id", async (request, reply) => {
    const id = idSchema.safeParse((request.params as { id?: string }).id);
    if (!id.success) return reply.code(400).send({ error: "invalid_id" });
    return service.get(id.data);
  });

  app.post(
    "/v1/admin/knowledge/documents",
    { bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const body = documentSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_knowledge" });
      try {
        const document = await service.create(body.data);
        await repository.audit({
          actor: "admin-api",
          action: "knowledge.document_created",
          targetType: "knowledge_source",
          targetId: document.id,
          details: { title: document.title, version: document.version },
        });
        return reply.code(201).send(document);
      } catch (error) {
        return errorReply(reply, error);
      }
    },
  );

  app.patch(
    "/v1/admin/knowledge/documents/:id",
    { bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const id = idSchema.safeParse((request.params as { id?: string }).id);
      const body = documentSchema.safeParse(request.body);
      if (!id.success || !body.success) {
        return reply.code(400).send({ error: "invalid_knowledge" });
      }
      try {
        const document = await service.update(id.data, body.data);
        await repository.audit({
          actor: "admin-api",
          action: "knowledge.document_updated",
          targetType: "knowledge_source",
          targetId: document.id,
          details: { title: document.title, version: document.version },
        });
        return document;
      } catch (error) {
        return errorReply(reply, error);
      }
    },
  );

  app.delete("/v1/admin/knowledge/documents/:id", async (request, reply) => {
    const id = idSchema.safeParse((request.params as { id?: string }).id);
    const body = z.object({ confirm: z.literal(true) }).safeParse(request.body);
    if (!id.success || !body.success) {
      return reply.code(400).send({ error: "confirmation_required" });
    }
    try {
      await service.delete(id.data);
      await repository.audit({
        actor: "admin-api",
        action: "knowledge.document_deleted",
        targetType: "knowledge_source",
        targetId: id.data,
        details: {},
      });
      return { deleted: true };
    } catch (error) {
      return errorReply(reply, error);
    }
  });
}
