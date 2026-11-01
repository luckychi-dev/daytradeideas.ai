CREATE UNIQUE INDEX IF NOT EXISTS subscribers_web_email_unique_idx
  ON subscribers (lower(verified_email))
  WHERE interface_kind = 'web' AND verified_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_web_wordpress_unique_idx
  ON subscribers (wordpress_user_id)
  WHERE interface_kind = 'web' AND wordpress_user_id IS NOT NULL;
