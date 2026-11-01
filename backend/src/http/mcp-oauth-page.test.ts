import { describe, expect, it } from "vitest";
import { renderAuthorizationPage } from "./mcp-oauth-page.js";

describe("MCP authorization page", () => {
  it("preserves the authorization code request when the form is submitted", () => {
    const html = renderAuthorizationPage({
      clientName: "ChatGPT",
      email: "",
      clientId: "mcp_client",
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
      codeChallenge: "challenge",
      resource: "https://api.example.com/mcp",
      scope: "knowledge:read knowledge:write",
      state: "state-1",
    });
    expect(html).toContain(
      '<input type="hidden" name="response_type" value="code">',
    );
  });
});
