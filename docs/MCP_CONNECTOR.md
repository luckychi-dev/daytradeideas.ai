# ChatGPT knowledge connector

The backend exposes a private MCP connector so an authorised ChatGPT account can
read and manage Jason's knowledge library.

## Production endpoints

- MCP server: `https://api.ai.daytradeideas.co.uk/mcp`
- Protected resource metadata:
  `/.well-known/oauth-protected-resource`
- OAuth metadata:
  `/.well-known/oauth-authorization-server`
- OAuth authorisation and token routes: `/oauth/authorize`, `/oauth/token`
- Dynamic client registration: `/oauth/register`
- Connector icon: `https://ai.daytradeideas.co.uk/icons/icon-512.png`

The connector uses OAuth 2.1 with PKCE `S256`, short-lived single-use
authorisation codes, hashed opaque access tokens, rotating refresh tokens, and
`knowledge:read` / `knowledge:write` scopes.

## Connect ChatGPT

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins) on the web.
2. Select the plus button, then **Add custom MCP server**.
3. Name it **Jason Knowledge**.
4. Enter `https://api.ai.daytradeideas.co.uk/mcp` as the server URL.
5. Choose **OAuth** authentication and create the plugin.
6. When the authorisation page opens, enter one of `MCP_ADMIN_EMAILS` and
   `MCP_ADMIN_PASSWORD` from the deployment `.env`.
7. Install the plugin, then select it with `@Jason Knowledge` in a chat.

Custom MCP setup is performed on the web. Once installed, the plugin is
available in ChatGPT Chat and Work on supported mobile clients.

## Tools

- `get_connector_profile`
- `list_knowledge_documents`
- `search`
- `fetch`
- `create_knowledge_document`
- `update_knowledge_document`
- `delete_knowledge_document`

Every mutation uses the existing knowledge-management service, rebuilds
retrieval chunks, and writes an admin audit record. Deletion requires the exact
current document title as a second confirmation.

## Credentials and revocation

`MCP_ADMIN_EMAILS` and `MCP_ADMIN_PASSWORD` exist only in the local and server
`.env` files. Never place them in WordPress, source control, or ChatGPT.

To sign every connected client out immediately, run:

```sh
docker compose --project-name daytrade-ai --project-directory deploy/api \
  exec -T postgres psql -U daytrade -d daytrade \
  -c "TRUNCATE mcp_oauth_tokens, mcp_oauth_codes;"
```

Reconnect the plugin after changing the admin password.

## Local verification

Start the stack and use MCP Inspector:

```sh
npx @modelcontextprotocol/inspector@latest
```

Select Streamable HTTP and enter `http://localhost:3000/mcp`. The endpoint
returns `401` with OAuth discovery metadata until the client authenticates.
