# Verification email delivery

OTP emails are sent by WordPress, not by the backend or web `.env`. The backend
asks the WordPress bridge to create and mail the code.

## Current diagnosis

- The bridge now sends OTPs to any existing WordPress user, whether or not a
  WooCommerce Membership exists.
- A controlled request for the previously failing non-member account was logged
  by WordPress with no transport error.
- WordPress is currently using the server-local `sendmail` transport.
- An internal `wp_mail()` transport check was accepted by WordPress.
- The ZeptoMail-specific DKIM TXT and bounce CNAME were removed from cPanel.
- ZeptoMail is not part of the current delivery path.

The generic request response is intentional. It avoids revealing whether an
email belongs to a WordPress user.

## WordPress mail path

OTP messages use WordPress and the server-local `sendmail` transport. They do
not require SMTP credentials in the backend `.env`. Mail is sent as
`no-reply@daytradeideas.co.uk` through the existing WordPress mu-plugin.

If production delivery later proves unreliable, configure a mailbox or SMTP
provider inside WordPress. Do not add provider credentials to frontend code or
tracked plugin source.

## Test order

1. Confirm the WordPress transport remains healthy.
2. Verify a registered email with or without an active WooCommerce Membership.
3. Confirm a non-subscribed account receives the plan options and remains
   inactive.
