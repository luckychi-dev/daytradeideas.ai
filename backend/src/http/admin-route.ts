import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminRepository, XaiBillingPort } from "../domain/admin-ports.js";
import type { RuntimeSettingsRepository } from "../domain/ports.js";
import type { SubscriptionReconciler } from "../domain/subscription-reconciler.js";
import type { RetentionService } from "../domain/retention-service.js";
import type { FeedbackRepository } from "../domain/feedback-ports.js";
import { secretMatches } from "./service-auth.js";
import { registerAdminAnalysisRoute } from "./admin-analysis-route.js";
import { registerAdminOperationRoutes } from "./admin-operations-route.js";
import { registerAdminFeedbackRoutes } from "./admin-feedback-route.js";
import { registerAdminBillingRoute } from "./admin-billing-route.js";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export interface AdminRouteDependencies {
  adminToken: string;
  repository: AdminRepository;
  settings: RuntimeSettingsRepository;
  reconciler: SubscriptionReconciler;
  retention: RetentionService;
  integrationStatus: () => Promise<Record<string, unknown>>;
  feedback: FeedbackRepository;
  xaiBilling: XaiBillingPort;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  dependencies: AdminRouteDependencies,
): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/admin")) return;
    const supplied = request.headers["x-admin-token"];
    const token = Array.isArray(supplied) ? supplied[0] : supplied;
    if (!secretMatches(token, dependencies.adminToken)) {
      await reply.code(401).send({ error: "unauthorized_admin" });
    }
  });

  app.get("/v1/admin/overview", async () => dependencies.repository.overview());

  app.get("/v1/admin/subscribers", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: "invalid_pagination" });
    const query = z.object({
      search: z.string().max(200).default(""),
      status: z.enum(["pending", "active", "suspended"]).optional(),
    }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_filter" });
    return {
      data: await dependencies.repository.listSubscribers({ ...page.data, ...query.data }),
    };
  });

  app.patch("/v1/admin/subscribers/:id/status", async (request, reply) => {
    const id = z.string().uuid().safeParse((request.params as { id?: string }).id);
    const body = z.object({ status: z.enum(["active", "suspended"]) }).safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    await dependencies.repository.updateSubscriberStatus(id.data, body.data.status);
    await dependencies.repository.audit({
      actor: "admin-api",
      action: "subscriber.status_changed",
      targetType: "subscriber",
      targetId: id.data,
      details: { status: body.data.status },
    });
    return { updated: true };
  });

  app.post("/v1/admin/subscribers/:id/unlink", async (request, reply) => {
    const id = thisId(request.params);
    if (!id) return reply.code(400).send({ error: "invalid_id" });
    await dependencies.repository.unlinkSubscriber(id);
    await dependencies.repository.audit({
      actor: "admin-api",
      action: "subscriber.unlinked",
      targetType: "subscriber",
      targetId: id,
      details: {},
    });
    return { unlinked: true };
  });

  app.delete("/v1/admin/subscribers/:id", async (request, reply) => {
    const id = thisId(request.params);
    const body = z.object({ confirm: z.literal(true) }).safeParse(request.body);
    if (!id || !body.success) return reply.code(400).send({ error: "confirmation_required" });
    await dependencies.repository.deleteSubscriber(id);
    await dependencies.repository.audit({
      actor: "admin-api",
      action: "subscriber.deleted",
      targetType: "subscriber",
      targetId: id,
      details: {},
    });
    return { deleted: true };
  });

  app.get("/v1/admin/answers", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: "invalid_pagination" });
    return { data: await dependencies.repository.listAnswers(page.data.limit, page.data.offset) };
  });

  app.get("/v1/admin/usage", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: "invalid_pagination" });
    return { data: await dependencies.repository.listUsage(page.data.limit, page.data.offset) };
  });

  app.get("/v1/admin/subscription-events", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: "invalid_pagination" });
    return {
      data: await dependencies.repository.listSubscriptionEvents(
        page.data.limit,
        page.data.offset,
      ),
    };
  });

  app.get("/v1/admin/knowledge", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    const query = z.object({
      status: z.enum(["approved", "validation_required", "rejected", "superseded"]).optional(),
    }).safeParse(request.query);
    if (!page.success || !query.success) return reply.code(400).send({ error: "invalid_filter" });
    return {
      data: await dependencies.repository.listKnowledge(
        query.data.status,
        page.data.limit,
        page.data.offset,
      ),
    };
  });

  app.post("/v1/admin/knowledge/:id/approval", async (request, reply) => {
    const id = thisId(request.params);
    const body = z.object({ approved: z.boolean() }).safeParse(request.body);
    if (!id || !body.success) return reply.code(400).send({ error: "invalid_request" });
    await dependencies.repository.approveChunk(id, body.data.approved);
    await dependencies.repository.audit({
      actor: "admin-api",
      action: body.data.approved ? "knowledge.approved" : "knowledge.rejected",
      targetType: "knowledge_chunk",
      targetId: id,
      details: {},
    });
    return { updated: true };
  });

  app.get("/v1/admin/audit", async (request, reply) => {
    const page = paginationSchema.safeParse(request.query);
    if (!page.success) return reply.code(400).send({ error: "invalid_pagination" });
    return { data: await dependencies.repository.listAudit(page.data.limit, page.data.offset) };
  });

  await registerAdminOperationRoutes(app, dependencies);
  await registerAdminFeedbackRoutes(app, dependencies.feedback, dependencies.repository);
  await registerAdminAnalysisRoute(app, dependencies.repository);
  await registerAdminBillingRoute(app, dependencies.xaiBilling);
}

function thisId(params: unknown): string | null {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(params);
  return parsed.success ? parsed.data.id : null;
}
