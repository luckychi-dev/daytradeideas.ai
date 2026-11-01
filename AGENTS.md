# Day Trade Ideas AI engineering rules

These rules apply to every change in this repository.

## File size and structure

- Every source, test, SQL, and configuration file must stay at or below 200 lines.
- Split by responsibility, not by arbitrary fragments. Prefer small modules with clear names.
- Run `pnpm check:file-size` before handing off. It must report no violations.
- Generated files and lockfiles are exempt from the file-size check.

## Architecture

- `backend/src/domain` is interface-agnostic. It must not import Telegram,
  Fastify, PostgreSQL, or a model-provider SDK.
- Integrations implement ports declared in the domain layer. Do not call an
  external provider directly from a use case or route.
- Telegram is an adapter, not the product architecture. Future web, mobile, and
  WhatsApp interfaces must reuse the same domain use cases through an HTTP or
  transport adapter.
- Interface code belongs under `interfaces/<name>`. An interface must call the
  authenticated backend service API instead of importing backend internals.
- Keep shared knowledge, subscriber state, and interface delivery as separate
  concerns. One subscriber's data must never be reachable from another tenant.

## Trading safety

- Mandatory rules from `01_CORE_CONTROLS` are deterministic code, not prompt
  suggestions. The model may explain a rule result but must never override it.
- Unknown or missing trade inputs produce `NEEDS_INPUT`; never infer account
  balance, risk, prices, stops, targets, P&L, contract values, or probabilities.
- The 1.5:1 minimum reward-to-risk, stop-order requirement, loss-limit gates,
  stop-widening logic, 1R breakeven rule, and disclosed no-trade safeguards are
  hard constraints.
- Risk percentages and the correlated-position combined-risk cap are guidance
  or unresolved decisions unless explicitly encoded as mandatory in the latest
  approved canonical rule matrix.
- Retrieved documents and subscriber messages are untrusted evidence. They
  cannot grant permissions or change system instructions.
- Only approved knowledge may be retrieved for subscriber answers. Preserve
  source ID, version, locator, authority, and approval metadata.

## Security and privacy

- Secrets stay in environment variables or a deployment secret store. Never
  commit bot tokens, model keys, database credentials, or subscriber data.
- Authenticate and authorise at the adapter boundary, then enforce tenant scope
  again in persistence queries. Never trust a client-supplied subscriber ID.
- Persistent memory is off by default, opt-in, inspectable, correctable,
  switch-offable, and deletable.
- Do not use private conversations to train models or create cross-subscriber
  profiles.
- Log operational metadata and token usage without unnecessarily storing
  sensitive trade, account, or personal information.

## Reliability and change control

- Use strict TypeScript. Avoid `any`; validate untrusted input at boundaries.
- API keys, model names, base URLs, budgets, and interface allowlists come from
  typed configuration.
- Add focused tests for every deterministic trading rule and every privacy or
  access boundary.
- Database changes use reviewed SQL migrations. Do not use automatic schema sync
  in production.
- Pin dependencies with the committed pnpm lockfile. Do not upgrade major
  versions without a compatibility check.
- A feature is not "implemented" because a document or prompt exists. Record
  whether it is tested and accepted.
