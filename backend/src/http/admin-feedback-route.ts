import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { FeedbackRepository } from "../domain/feedback-ports.js";

const page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function registerAdminFeedbackRoutes(
  app: FastifyInstance,
  repository: FeedbackRepository,
  admin: AdminRepository,
): Promise<void> {
  app.get("/v1/admin/feedback", async (request, reply) => {
    const parsed = page.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_pagination" });
    return { data: await repository.list(parsed.data.limit, parsed.data.offset) };
  });

  app.patch("/v1/admin/feedback/:id", async (request, reply) => {
    const id = z.string().uuid().safeParse((request.params as { id?: string }).id);
    const body = z.object({
      status: z.enum(["new", "reviewing", "resolved"]),
      note: z.string().max(2000).nullable().optional(),
    }).safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    await repository.updateStatus(id.data, body.data.status, body.data.note ?? null);
    await admin.audit({
      actor: "admin-api",
      action: "feedback.updated",
      targetType: "feedback",
      targetId: id.data,
      details: { status: body.data.status },
    });
    return { updated: true };
  });
}

