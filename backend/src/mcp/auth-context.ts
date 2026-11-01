import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "../domain/mcp-oauth-types.js";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function adminContext(extra: ToolExtra, scope: string): {
  actor: string;
  email: string;
} {
  const auth = extra.authInfo;
  if (!auth || !auth.scopes.includes(scope)) {
    throw new Error(
      scope === MCP_WRITE_SCOPE
        ? "This action requires knowledge:write permission."
        : "This action requires knowledge:read permission.",
    );
  }
  const email = typeof auth.extra?.email === "string" ? auth.extra.email : "admin";
  return { actor: `mcp:${email}`, email };
}

export function readScope(extra: ToolExtra): { actor: string; email: string } {
  return adminContext(extra, MCP_READ_SCOPE);
}

export function writeScope(extra: ToolExtra): { actor: string; email: string } {
  return adminContext(extra, MCP_WRITE_SCOPE);
}
