# Deployment baseline

## Production URLs

- Web PWA: `https://ai.daytradeideas.co.uk`
- Backend and web API bridge: `https://api.ai.daytradeideas.co.uk`
- Telegram webhook: `https://api.ai.daytradeideas.co.uk/telegram/webhooks/telegram`
- WordPress bridge: `https://www.daytradeideas.co.uk/wp-json/dtiai/v1`

The web PWA is served from NameHero at
`/home8/httpdayt/ai.daytradeideas.co.uk`. The backend stack runs from
`/opt/daytrade-ai/deploy/api` on the managed VPS with its own PostgreSQL volume.
Only Caddy ports 80/443 are public; service ports bind to localhost.

## Services

`docker-compose.yml` runs:

- PostgreSQL with pgvector
- The backend API on port 3000
- The browser web interface on port 3002
- The Telegram webhook service on port 3001

The backend applies pending SQL migrations at startup. When `PUBLIC_BASE_URL`
is localhost, the Telegram interface uses long polling automatically. A public
HTTPS URL is required before switching to webhook mode.

The web interface is an installable PWA. Android installation requires the final
public site to use HTTPS; local installation works on `localhost`.

## Environment

Provider credentials remain in the root `.env` and must not be added to the
images or repository.

Required before a full live start:

- `DEEPSEEK_API_KEY`
- `XAI_API_KEY` for voice notes
- `TELEGRAM_BOT_TOKEN`
- `PUBLIC_BASE_URL`, pointing to the public Telegram interface URL

Generated service, webhook, admin, and WordPress bridge secrets are already in
`.env`. The same `WORDPRESS_BRIDGE_SECRET` must be stored in
**WordPress → Settings → Day Trade Ideas AI**.

## Commands

```sh
docker compose up -d
docker compose ps
docker compose logs -f backend telegram-interface
```

For web-interface hot reload during development:

```sh
pnpm web:dev
```

Register the Telegram webhook:

```sh
pnpm telegram:webhook
```

Do not run webhook mode and polling mode against the same bot simultaneously.
The interface selects polling only when `PUBLIC_BASE_URL` is local.

## Split-domain web API

`ai.daytradeideas.co.uk/api/*` is proxied through Caddy to the private web bridge
on `127.0.0.1:3102`. Credentialed CORS allows only
`https://ai.daytradeideas.co.uk`. Public Caddy routes also include the Telegram
webhook, signed WordPress events, and token-protected admin endpoints. Internal
`/v1/internal/*` routes return 404 from the public host.

## Health

- Backend liveness: `GET /health/live`
- Backend readiness: `GET /health/ready`
- Telegram interface: `GET /health/live`
- WordPress bridge: `GET /wp-json/dtiai/v1/health`

## Backups

```sh
./scripts/backup-database.sh
```

The script writes compressed backups to `backups/` and retains fourteen days.
Move backups to encrypted remote storage for production.

## Network boundary

Only the Telegram webhook and the future admin interface should be public. Keep
the backend internal service API private and authenticated. The shared interface
token does not replace a public user-authentication layer.
