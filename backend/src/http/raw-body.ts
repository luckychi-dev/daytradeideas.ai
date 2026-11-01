import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export function registerRawJsonBody(app: FastifyInstance): void {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request: FastifyRequest, body: string, done) => {
      request.rawBody = body;
      try {
        done(null, JSON.parse(body));
      } catch (error) {
        done(error as Error);
      }
    },
  );
}

