# Day Trade Ideas AI

Private AI trading mentor built from the approved Day Trade Ideas knowledge
base. Telegram and web are separate interfaces over one interface-independent
backend, with room for mobile or other transports later.

## Stack

- Node.js 22 + strict TypeScript
- `backend/`: Fastify mentor API, persistence, retrieval, model and risk logic
- `interfaces/web/`: installable mobile-first PWA with public membership support
  and a secure server bridge
- `interfaces/telegram/`: Telegram webhook and delivery adapter
- PostgreSQL 17 + pgvector
- DeepSeek through an OpenAI-compatible model adapter
- xAI speech-to-text and Grok vision adapters for voice and chart evidence
- `interfaces/`: independent Telegram and web adapters

## Local setup

1. Copy `.env.example` to `.env` and fill in the model and Telegram credentials.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Install dependencies: `pnpm install`
4. Run migrations: `pnpm db:migrate`
5. Ingest approved rules and staging candidates: `pnpm ingest:staging`
6. Start all interfaces and the backend: `pnpm dev`
7. Or run only the web interface: `pnpm web:dev`

Use `pnpm check` before handoff. The repository enforces a 200-line maximum for
source, test, SQL, and configuration files.

The web interface runs at `http://localhost:5173`. See
`docs/WEB_INTERFACE.md` for its authentication and deployment boundary.

## Configuration

`.env` and `.env.example` belong at the repository root. During local
development, this single file is shared by `backend/` and
`interfaces/telegram/`. `INTERFACE_SERVICE_TOKEN` is shared by both services
and is configured once.

Never commit `.env`. In production, give each service only the variables it
needs through that host's secret manager. `PUBLIC_BASE_URL` must be a public
HTTPS URL before Telegram webhook registration can succeed.

## Current milestone

The backend foundation covers configuration, PostgreSQL migrations, authenticated
interface APIs, per-subscriber conversation storage, model access through a port,
usage accounting, deterministic trade-risk gates, and provenance-aware knowledge
ingestion. The Telegram interface runs independently and is connected only
through the backend service API.

The structured risk contract is available at
`POST /v1/internal/risk-assess`. It returns the deterministic engine result and
natural-language requests are now extracted into structured trade data before
the engine runs. Live DeepSeek extraction and answer generation are verified,
including the hard 1.5:1 reward-to-risk gate.

Web and Telegram support image questions for active subscribers. Both interfaces
also support voice notes and can return Jason Sen voice-note replies through the
private Chatterbox adapter. Speech and visual evidence use the same mentor and
knowledge pipeline without persisting raw audio or images. See
`docs/SUBSCRIPTION_IDENTITY.md`, `docs/VOICE_INPUT.md`, `docs/VOICE_OUTPUT.md`,
and `docs/WEB_INTERFACE.md`.

## Subscription access

The Telegram bot treats the environment allowlist only as an emergency/admin
bypass. Normal subscribers verify with the email on an active WooCommerce
Membership:

1. First message: the bot sends the branded welcome image and one **Link my account**
   button.
2. WordPress sends a six-digit code when the account has an active membership.
3. The subscriber enters the code in Telegram.
4. The backend links that Telegram identity to exactly one WordPress user.
5. Membership status events revoke access when the entitlement becomes inactive.

The account-link button is removed after it is tapped. Successful verification
keeps the rest of the flow inside the Telegram chat, with no separate screen to
close.

The WordPress integration lives under
`integrations/wordpress/daytradeideas-ai-bridge/`. Set the same
`WORDPRESS_BRIDGE_SECRET` in the root `.env` and in **Settings → Day Trade Ideas
AI** on WordPress. Set the public backend URL only after the backend is
deployed.

Only confirmed canonical rules enter production retrieval. Teaching candidates
are ingested as `validation_required` and remain admin-only until reviewed.
Subscriber memory controls, structured trade-extraction orchestration, approval
tooling, and deployment automation are implemented. The WordPress **Jason AI**
admin page proxies the monitoring, configuration, knowledge, subscriber, usage,
audit, and feedback endpoints documented in `docs/ADMIN_API.md`.

Architecture decisions and phased delivery are documented in
`docs/ARCHITECTURE.md`. Ingestion and approval boundaries are documented in
`docs/KNOWLEDGE_PIPELINE.md`.
