import type { FastifyReply } from "fastify";
import type { WebIdentity } from "./backend-client.js";
import { resolveSession, sessionCookie } from "./session.js";

export function sessionFor(
  sessionSecret: string,
  secureCookie: boolean,
  cookieHeader: string | undefined,
  reply: FastifyReply,
): WebIdentity {
  const session = resolveSession(cookieHeader, sessionSecret);
  reply.header("set-cookie", sessionCookie(session.cookieValue, secureCookie));
  return session.identity;
}
