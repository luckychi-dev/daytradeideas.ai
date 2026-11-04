# Architecture decision

## Recommendation

Use a TypeScript modular backend plus thin interface services. The backend is
deployed as one small service, while each interface owns only transport,
identity forwarding, and presentation.

This is the TypeScript equivalent of the stack agreed with Jason, rather than a
second architecture. It preserves PostgreSQL, pgvector, DeepSeek, retrieval,
deterministic risk checks, and low-cost VPS deployment.

| Concern | Pilot choice | Reason |
| --- | --- | --- |
| Runtime | Node.js 22 + TypeScript | One language for the team, strong typing, low VPS overhead |
| HTTP | Fastify | Small core, schema validation, webhook-friendly |
| Telegram | Bot API adapter | Keeps Telegram outside the domain and avoids UI lock-in |
| Model | DeepSeek via OpenAI-compatible adapter | Low-cost starting point while allowing provider replacement |
| Media | xAI speech-to-text and Grok vision | Adds audio and chart evidence without changing the text agent |
| State | PostgreSQL 17 | Transactions, access control, auditability, one database |
| Retrieval | PostgreSQL full-text first, pgvector next | Gets grounded retrieval working cheaply before embedding-provider lock-in |
| Hosting | Small Linux VPS + Docker Compose | Predictable infrastructure cost for the trusted pilot |

## Boundaries

```text
Telegram webhook
      |
      v
interfaces/telegram -- authenticated service API --> backend/
                                                        |
                         +------------------------------+------------------+
                         |                              |                  |
              Mentor + media use cases        Risk engine       Knowledge ingest
                         |                              |                  |
                         +----------------------+-------+------------------+
                                                |
                                       PostgreSQL + pgvector
                                                |
                         DeepSeek + speech-to-text + vision adapters
```

The domain never imports Fastify, Telegram, PostgreSQL, or OpenAI SDK types.
External data crosses validated adapter boundaries. Interface services never
import backend internals, so adding `interfaces/web` or `interfaces/mobile` does
not require rebuilding the mentor backend.

## Interface service API

Interface services call `/v1/internal/*` with a shared `x-service-token`.
Requests carry the interface name and external user ID; the backend performs
access authorisation and tenant scoping. The backend port should remain on a
private network in production, with the token as defence in depth.

The current API exposes subscriber access checks, mentor chat, voice
transcription, image evidence extraction, and structured risk assessment. A
future public API must preserve authentication and rate limiting rather than
exposing internal routes directly.

## Why not FastAPI

FastAPI is a sound choice and remains the fallback if the implementation must
follow Jason’s Python preference. TypeScript improves ownership here because the
project owner is more comfortable maintaining it, future clients are likely to
share contracts, and the service stays small enough that Python’s ecosystem
advantages are not decisive.

## Cost position

Infrastructure and model usage are separate budgets. A USD 7 VPS estimate does
not include DeepSeek tokens, backups, monitoring, or incident headroom. The
pilot must record actual token usage; per-consumer monthly estimates are not
reliable until real prompt sizes and retrieval context are measured.

## Delivery sequence

1. Backend and interface foundation: complete.
2. Deterministic risk engine: mandatory gates, trade extraction, and
   model-to-engine orchestration are implemented and live-verified.
3. Knowledge ingestion: staging ingestion and canonical promotion implemented;
   chunk approval, PDF OCR, embeddings, and retrieval QA remain.
4. Mentor orchestration: trade extraction, deterministic gates, and live model
   evaluation are complete.
5. Memory controls: opt-in, inspect, correct, disable, delete, and retention are
   implemented behind a global admin switch.
6. Interface media: web/Telegram voice notes, Jason voice output, and chart
   image evidence are implemented and live-verified. Browser calls remain
   unavailable.
7. Pilot hardening: idempotency, quotas, reconciliation, admin APIs, backup and
   deployment baseline are implemented; production deployment remains.

## Important non-decisions

- No public registration.
- No live market feed, broker connection, phone/SIP telephony, or trading
  execution in the pilot.
- No correlated-position combined-risk percentage until the owner approves a
  canonical rule.
- No podcast material in subscriber retrieval until attribution and approval are
  complete.
