# Day Trade Ideas AI WordPress bridge

This plugin exposes these endpoints under `/wp-json/dtiai/v1/`:

- `GET /health`
- `POST /request-code`
- `POST /verify-code`
- `POST /membership-status`
- `POST /plans`

The code endpoints require HMAC headers generated from the shared bridge secret:

- `X-DTIAI-Timestamp`
- `X-DTIAI-Nonce`
- `X-DTIAI-Signature`

The signature covers:

```text
timestamp + "\n" + nonce + "\n" + raw-json-body
```

`request-code` issues a six-digit email code when the email belongs to a
WordPress user. Active membership is not required to verify ownership of the
email. The code expires after ten minutes, and unknown emails still receive a
generic response.

`verify-code` returns the WordPress user ID, normalized email, and current active
membership metadata only after the OTP succeeds. An empty membership list means
the email is verified but the account has no active subscription.

`plans` returns published WooCommerce subscription products, current prices,
billing cadence and purchase URLs. Results are cached in WordPress for five
minutes.

Membership status changes are posted to:

```text
/v1/integrations/wordpress/membership
```

No subscriber password or WooCommerce credential is exposed.

## Install

Copy the plugin directory into `wp-content/plugins/`, then run:

```sh
wp plugin activate daytradeideas-ai-bridge
```

Open **Settings → Day Trade Ideas AI** and set:

- Backend URL: the public HTTPS base URL of the `backend/` service
- Shared secret: the same value as `WORDPRESS_BRIDGE_SECRET` in the backend
  environment
- Admin API token: the same value as `ADMIN_API_TOKEN` in the backend

The secret must contain at least 32 characters. The bridge stores its
configuration in WordPress options; constants named `DTIAI_BACKEND_URL` and
`DTIAI_BRIDGE_SECRET` override the options. `DTIAI_ADMIN_API_TOKEN` overrides
the admin token option.

## Management dashboard

The top-level **Jason AI** admin menu provides:

- Overview and usage analysis
- Current xAI prepaid credit balance
- Upload, edit and delete knowledge documents without changing code
- Subscriber suspension, reactivation, unlinking and deletion
- Knowledge review and approval
- Feedback review
- Runtime configuration
- Subscription reconciliation, retention and activity/audit views

The browser calls a WordPress REST proxy protected by `manage_options` and a
WordPress REST nonce. The backend admin token stays server-side.

## Email behavior

Codes are sent with `wp_mail`. ZeptoMail is not technically required for
WordPress to send mail, but configuring authenticated SMTP improves delivery.
The existing WP Mail Logging plugin will log the message unless explicitly
filtered, so limit administrator access and retention.
