import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AdminRepository } from "../domain/admin-ports.js";
import type { McpOAuthClientService } from "../domain/mcp-oauth-client-service.js";
import { digest } from "../domain/mcp-oauth-crypto.js";
import { McpOAuthError, type McpOAuthService } from "../domain/mcp-oauth-service.js";
import {
  renderAuthorizationPage,
  renderOAuthErrorPage,
} from "./mcp-oauth-page.js";

interface OAuthRouteOptions {
  resource: string;
  clients: McpOAuthClientService;
  oauth: McpOAuthService;
  admin: AdminRepository;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function queryRecord(request: FastifyRequest): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    (request.query ?? {}) as Record<string, unknown>,
  )) result[key] = stringValue(value);
  return result;
}

function bodyRecord(request: FastifyRequest): Record<string, string> {
  if (request.body && typeof request.body === "object") {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.body as Record<string, unknown>)) {
      result[key] = stringValue(value);
    }
    return result;
  }
  return {};
}

function noStore(reply: FastifyReply, contentType = "application/json; charset=utf-8"): FastifyReply {
  return reply
    .header("cache-control", "no-store")
    .header("pragma", "no-cache")
    .type(contentType);
}

function page(reply: FastifyReply, status: number, html: string): FastifyReply {
  return noStore(reply, "text/html; charset=utf-8")
    .header(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    )
    .header("x-frame-options", "DENY")
    .code(status)
    .send(html);
}

function oauthError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof McpOAuthError) {
    return noStore(reply).code(error.statusCode).send({
      error: error.code,
      error_description: error.message,
    });
  }
  throw error;
}

async function renderAuthorization(
  request: FastifyRequest,
  reply: FastifyReply,
  options: OAuthRouteOptions,
  input: Record<string, string>,
  error?: string,
): Promise<FastifyReply> {
  try {
    const authorization = await options.oauth.validateAuthorization(input);
    return page(reply, error ? 401 : 200, renderAuthorizationPage({
      clientName: authorization.client.clientName,
      email: input.email ?? "",
      clientId: authorization.client.clientId,
      redirectUri: authorization.redirectUri,
      codeChallenge: authorization.codeChallenge,
      resource: authorization.resource,
      scope: authorization.scopes.join(" "),
      state: authorization.state,
      error,
    }));
  } catch (validationError) {
    const message = validationError instanceof Error
      ? validationError.message
      : "Authorization request is invalid.";
    return page(reply, 400, renderOAuthErrorPage(message));
  }
}

export async function registerMcpOAuthRoutes(
  app: FastifyInstance,
  options: OAuthRouteOptions,
): Promise<void> {
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => done(
      null,
      Object.fromEntries(new URLSearchParams(body.toString())),
    ),
  );

  app.get("/oauth/authorize", async (request, reply) =>
    renderAuthorization(request, reply, options, queryRecord(request)));

  app.post("/oauth/authorize", async (request, reply) => {
    const input = bodyRecord(request);
    const email = input.email ?? "";
    try {
      await options.clients.checkRateLimit(`mcp-login:${digest(request.ip)}`, 5, 900);
    } catch (error) {
      if (error instanceof McpOAuthError) {
        return page(reply, error.statusCode, renderOAuthErrorPage(
          `Too many attempts. ${error.message}`,
        ));
      }
      throw error;
    }
    if (!options.clients.authenticate(email, input.password ?? "")) {
      return renderAuthorization(
        request, reply, options, input, "The admin email or password is incorrect.",
      );
    }
    try {
      const authorization = await options.oauth.validateAuthorization(input);
      const code = await options.oauth.issueCode(authorization, email.toLowerCase());
      await options.admin.audit({
        actor: email.toLowerCase(),
        action: "mcp.oauth_authorized",
        targetType: "oauth_client",
        targetId: authorization.client.clientId,
        details: {},
      });
      const target = new URL(authorization.redirectUri);
      target.searchParams.set("code", code);
      if (authorization.state) target.searchParams.set("state", authorization.state);
      return reply.redirect(target.toString());
    } catch (error) {
      if (error instanceof McpOAuthError) {
        return page(reply, error.statusCode, renderOAuthErrorPage(error.message));
      }
      throw error;
    }
  });

  app.post("/oauth/token", async (request, reply) => {
    const body = bodyRecord(request);
    const grant = z.enum(["authorization_code", "refresh_token"]).safeParse(body.grant_type);
    if (!grant.success) {
      return noStore(reply).code(400).send({
        error: "unsupported_grant_type",
        error_description: "Use authorization_code or refresh_token.",
      });
    }
    try {
      const token = grant.data === "authorization_code"
        ? await options.oauth.exchangeCode({
          code: body.code ?? "",
          clientId: body.client_id ?? "",
          redirectUri: body.redirect_uri ?? "",
          codeVerifier: body.code_verifier ?? "",
          resource: body.resource ?? options.resource,
        })
        : await options.oauth.refresh({
          refreshToken: body.refresh_token ?? "",
          clientId: body.client_id ?? "",
          resource: body.resource ?? options.resource,
          scopes: body.scope?.split(/\s+/).filter(Boolean),
        });
      return noStore(reply).send(token);
    } catch (error) {
      return oauthError(reply, error);
    }
  });
}
