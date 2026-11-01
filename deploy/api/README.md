# Managed API deployment

Target domain: `https://api.ai.daytradeideas.co.uk`
Public web origin: `https://ai.daytradeideas.co.uk`

Private service ports:

- Backend: `127.0.0.1:3100`
- Telegram interface: `127.0.0.1:3101`
- Web API bridge: `127.0.0.1:3102`
- ChatGPT knowledge MCP: backend port `3000`, public path `/mcp`

The Caddy site exposes only `/api/*`, the Telegram webhook, signed WordPress
events, token-protected admin routes, and the OAuth-protected `/mcp` connector.
Internal `/v1/internal/*` routes are not public.

The production stack runs from `/opt/daytrade-ai/deploy/api`. Its `.env` is
mode `0600` and is not stored in this repository.

## Deploy

```sh
docker compose --project-name daytrade-ai up -d --build
docker compose --project-name daytrade-ai ps
```

Install `Caddyfile` as the `api.ai.daytradeideas.co.uk` site, then validate and
reload Caddy:

```sh
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

After DNS and TLS are live, register the Telegram webhook:

```sh
pnpm telegram:webhook
```

## Backups

`backup.sh` creates a compressed PostgreSQL dump in `/opt/daytrade-ai/backups`
and removes dumps older than fourteen days. Install it as a daily root cron job
after deployment.
