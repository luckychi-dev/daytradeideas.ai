# Interfaces

Each folder is a thin client of the authenticated backend service API.

- `web/`: responsive subscriber chat with a server-side authenticated bridge.
- `telegram/`: Telegram webhook, Bot API delivery, and interface commands.
- Future: `mobile/` or `whatsapp/`.

Interface packages must not import files from `backend/src`. They receive a
backend response and render it for their transport.
