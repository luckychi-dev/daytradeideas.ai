# Admin API contract

The WordPress admin page at **Jason AI** is a server-side proxy that holds
`ADMIN_API_TOKEN`. Do not expose this token to browser JavaScript.

Configure **Settings → Day Trade Ideas AI** with:

- Public backend base URL.
- `ADMIN_API_TOKEN`.

The WordPress REST proxy requires `manage_options` and a valid WordPress REST
nonce. It allows only the documented monitoring, subscriber, knowledge,
feedback, settings and operations routes.

All admin requests use:

```http
x-admin-token: <ADMIN_API_TOKEN>
```

## Monitoring

- `GET /v1/admin/overview`
- `GET /v1/admin/subscribers?search=&status=&limit=&offset=`
- `GET /v1/admin/usage?limit=&offset=`
- `GET /v1/admin/answers?limit=&offset=`
- `GET /v1/admin/analysis?days=30`
- `GET /v1/admin/subscription-events?limit=&offset=`
- `GET /v1/admin/audit?limit=&offset=`
- `GET /v1/admin/integration-status`

`answers` includes the question, answer, model/provider, cited knowledge IDs,
prompt version, knowledge version, rule-engine version, and deterministic trade
assessment when one was run.

`analysis` aggregates assessment statuses, failed rule gates, provider cost and
latency, and the most-cited knowledge sources for a period of 1–365 days.

## Subscriber controls

- `PATCH /v1/admin/subscribers/:id/status` with `{"status":"active|suspended"}`
- `POST /v1/admin/subscribers/:id/unlink`
- `DELETE /v1/admin/subscribers/:id` with `{"confirm":true}`

Unlinking preserves conversation history. Deletion cascades conversations,
usage, memory, and audit records for that subscriber.

## Knowledge review

- `GET /v1/admin/knowledge?status=&limit=&offset=`
- `POST /v1/admin/knowledge/:id/approval` with `{"approved":true|false}`

Approving a chunk also approves its parent source. The response includes a
truncated preview, not the complete chunk text.

## Configuration and operations

- `GET /v1/admin/settings`
- `PATCH /v1/admin/settings`
- `POST /v1/admin/subscriptions/reconcile`
- `POST /v1/admin/retention/run`
- `GET /v1/admin/feedback?limit=&offset=`
- `PATCH /v1/admin/feedback/:id`

Runtime settings currently include monthly budget, daily message limit, daily
voice limit, trade-assessment availability, memory availability, and message
retention.

Provider keys cannot be edited through the admin API. They remain deployment
secrets and are changed through the host environment.

## Audit and safety

Mutating admin actions write to `admin_audit_log`. Subscriber deletion requires
an explicit confirmation field. The admin interface must show a second
confirmation before sending it.
