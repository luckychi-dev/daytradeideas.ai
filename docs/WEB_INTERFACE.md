# Web interface

The subscriber web interface lives in `interfaces/web`. It is a mobile-first
React application backed by a small Fastify server that keeps the shared
interface service token off the browser.

## Local run

The backend must be available first:

```sh
docker compose up -d postgres backend
pnpm web:dev
```

Open `http://localhost:5173`. The API bridge listens on port `3002`; Vite
proxies same-origin `/api` requests to it.

## Authentication

1. The server creates an opaque browser session.
2. The browser receives a signed `HttpOnly`, `SameSite=Lax` cookie.
3. The cookie is signed with `INTERFACE_SERVICE_TOKEN`.
4. The backend identity is derived from a hash of the opaque token, so the
   browser never sends a subscriber ID.
5. Email and OTP requests reuse the existing WordPress membership flow.
6. Only one web session can be linked to a WordPress account. A second browser
   is shown an **Use Here Instead** action after its OTP succeeds. Confirming it
   atomically revokes the previous web link and transfers access to the new
   browser.

OTP verifies ownership of any registered WordPress email, including accounts
without an active membership. In that case the browser is marked inactive and
the chat immediately returns the available plans. Clicking the AI avatar opens
the account menu; logout unlinks the identity and rotates the browser session.

Local development uses same-origin Vite `/api` proxying. The NameHero-hosted
production client calls `https://api.ai.daytradeideas.co.uk/api/*` directly with
credentials and an exact CORS allowlist. Production builds default to that API
origin; `VITE_API_BASE_URL` can override it. The browser never receives
`INTERFACE_SERVICE_TOKEN`, `ADMIN_API_TOKEN`, model keys, or WordPress secrets.

## Configuration

```env
WEB_PORT=3002
WEB_PUBLIC_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
TELEGRAM_BOT_URL=https://t.me/jasonsenaibot
INTERFACE_SERVICE_TOKEN=<generated-secret>
XAI_VISION_MODEL=grok-4.7
```

Set `WEB_PUBLIC_URL` to the real HTTPS origin before production deployment so
the session cookie receives the `Secure` flag.

## Current scope

- Single-screen responsive chat workspace with compact subscription verification
- Single desktop/mobile header with an avatar-only mobile identity
- Verified subscriber chat with provenance retained server-side for audit
- Public membership-help chat with live WooCommerce plan links
- Server-side request IDs and backend rate/cost controls
- Concurrent knowledge, memory and deterministic trade-safety preparation
- “Use in Telegram” for visitors and inactive members; hidden for active subscribers
- Chart-image questions for active subscribers
- Recorded voice notes with optional Jason voice replies for active subscribers
- Installable Android PWA with offline application-shell caching
- Docker packaging for the production build

## Images, voice notes and calls

An uploaded PNG or JPEG is resized in the browser before transmission. The
backend uses Grok vision only to extract visible, untrusted chart evidence. The
normal Jason model then answers using that evidence, approved knowledge and the
single subscriber conversation. Raw images are not persisted.

Voice notes use xAI speech-to-text and the same Jason conversation path. When
Chatterbox output is enabled, the assistant message includes a replayable audio
control for Jason's grounded answer. No audio is persisted. Browser microphone
access requires HTTPS in production or `localhost` during development.

Stopping a recording keeps a playable draft in the composer. It is transmitted
only when the subscriber clicks Send. The resulting user message retains that
recording as a replayable audio control alongside its transcript.

The hands-free browser call control is intentionally unavailable. It remains a
later interface after CPU speech-output latency and concurrency are measured.

## Public support

Unverified visitors and members without an active subscription can ask about
plans, pricing, billing, access and joining. The browser receives clickable plan
buttons generated from the live WooCommerce catalog. Public chat does not run
private knowledge retrieval or provide trading analysis; requests for trade
advice are redirected to subscription verification.

## PWA

The web app includes a manifest, 192/512px icons, an Android maskable icon,
Apple touch icon and service worker. On Android Chrome it can be installed to
the home screen and run in standalone mode. Production installation requires
HTTPS; `localhost` is accepted for local testing.

## Conversation context

Web and Telegram use one persistent conversation per subscriber and interface.
The database enforces a unique `(subscriber_id, interface_kind)` conversation,
so there is no chat switching or competing thread in either interface.

Each reply loads the most recent `CONVERSATION_HISTORY_LIMIT` messages, currently
20, and appends the new user and assistant messages to the same thread. Older
messages remain subject to the configured retention policy but are outside the
model context until a deliberate summarisation feature is added.
