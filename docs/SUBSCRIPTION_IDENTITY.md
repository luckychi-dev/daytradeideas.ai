# Subscription identity bridge

## Current allowlist role

`TELEGRAM_ALLOWED_USER_IDS` is a bootstrap gate used in the initial prototype.
It proves that a Telegram account was manually approved, but it does not prove
which Day Trade Ideas account the person owns and cannot know when a
subscription expires.

The allowlist should become an admin/emergency bypass only. Normal subscriber
access must come from a verified link to a WordPress user and a live membership
status.

## WordPress findings

Read-only inspection on 31 October 2026 found:

- WordPress 7.1.4
- WooCommerce 11.2.1
- WooCommerce Subscriptions 9.0.1
- WooCommerce Memberships 1.29.1
- 4,461 WordPress users
- 51 `wcm-active` user memberships
- 374 paused, 558 cancelled, 29 expired, and 6 pending memberships
- 44 active and 6 pending-cancel subscriptions
- 610 on-hold subscriptions

The raw subscription and membership counts are not interchangeable. Some active
memberships have no subscription link, and active or pending-cancel
subscriptions can have past schedule end dates. For access decisions, use the
actual WordPress membership entitlement:

```php
wc_memberships_get_user_active_memberships($user_id)
```

An order, payment, or WooCommerce subscription status alone is not sufficient.

## Recommended flow

1. The subscriber opens the bot from the web **Use in Telegram** deep link, then
   taps the single **Link my account** button and provides the email on their
   Day Trade Ideas account.
2. The backend asks a small WordPress bridge plugin whether that email belongs
   to a WordPress account. The response is generic to prevent account
   enumeration.
3. If the user exists, WordPress sends a short-lived six-digit email code even
   when no subscription is active. The code is hashed, expires after ten
   minutes, is single-use, and has an attempt limit.
4. The subscriber enters the code in Telegram.
5. The backend stores the interface identity to WordPress user ID link and the
   current entitlement status. A user without an active membership remains
   verified but inactive and is shown the current plans.
6. The inline link button is removed when tapped. After successful verification,
   the bot confirms that the verification form is closed and the user continues
   inside the same Telegram chat.
7. Membership status hooks push signed events to the backend. A periodic
   reconciliation job repairs missed events.
8. On cancellation, expiry, pause, or other losing status, existing Telegram
   access is revoked automatically.

The bot must never request a WordPress password.

Verification is rate-limited in layers:

- Request-code: 5 requests per interface identity per 15 minutes.
- Verify-code: 10 attempts per interface identity per 15 minutes.
- WordPress: 3 code requests per email per 10 minutes and 5 attempts per code.
- Web bridge: 12 verification requests per source IP per 10 minutes.

Users can unlink the current identity with `/unbind` and verify a different
email. The web interface exposes the same action from the avatar menu and rotates
the browser session on logout.

## Bridge surface

Create a small custom WordPress plugin, not direct database access from the
backend:

- `POST /wp-json/dtiai/v1/request-code`
- `POST /wp-json/dtiai/v1/verify-code`
- `GET /wp-json/dtiai/v1/health`
- `POST /wp-json/dtiai/v1/plans`
- Signed membership status notifications to
  `POST /v1/integrations/wordpress/membership`

All server-to-server requests require HTTPS, an HMAC signature, timestamp
validation, and replay protection. Store the shared secret in `wp-config.php`
or the deployment secret manager, never in tracked plugin source.

Relevant WordPress hooks include:

- `wc_memberships_user_membership_status_changed`
- `woocommerce_subscription_status_updated`

The membership hook is authoritative for access; the subscription hook provides
diagnostic context and faster notification.

## Backend data

Add linked account state for:

- WordPress user ID
- normalized email
- membership status and active product IDs
- last verified time
- access-effective time and expiry time
- link status
- subscription event IDs and delivery timestamps

Every Telegram request must still resolve its own channel identity to a current,
active backend entitlement. A stale verified link is not permanent access.

## Implementation status

- The bridge plugin is built under `integrations/wordpress/daytradeideas-ai-bridge`.
- The plugin is installed and active on the live WordPress site.
- The public health endpoint returns `ok` and confirms WooCommerce Memberships
  is available.
- HMAC-authenticated request handling has been tested without sending an email.
- The bridge secret is configured in WordPress and the backend environment.
- The live plan endpoint returns the three current monthly subscription products
  with prices and purchase URLs.
- The backend URL remains unset until the backend has a public HTTPS address.
- Outbound membership-change notifications remain disabled until the public
  backend URL is configured.

## Public membership support

Web and Telegram both expose a public support path for visitors without a
verified subscription. It uses the live plan catalog and can explain pricing,
billing, access and joining. It does not retrieve the approved trading knowledge
base and refuses personalised trade analysis until a subscription is verified.
