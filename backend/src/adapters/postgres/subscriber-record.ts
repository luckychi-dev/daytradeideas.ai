import type { InterfaceKind, Subscriber } from "../../domain/types.js";

export interface SubscriberRow {
  id: string;
  interface_kind: InterfaceKind;
  external_user_id: string;
  display_name: string | null;
  status: "pending" | "active" | "suspended";
  verified_email: string | null;
  wordpress_user_id: string | null;
  membership_status: string | null;
  access_expires_at: Date | null;
  last_verified_at: Date | null;
}

export const subscriberColumns = `id, interface_kind, external_user_id, display_name, status,
  verified_email, wordpress_user_id, membership_status, access_expires_at, last_verified_at`;

export function toSubscriber(row: SubscriberRow): Subscriber {
  return {
    id: row.id,
    interfaceKind: row.interface_kind,
    externalUserId: row.external_user_id,
    displayName: row.display_name,
    status: row.status,
    verifiedEmail: row.verified_email,
    wordpressUserId: row.wordpress_user_id ? Number(row.wordpress_user_id) : null,
    membershipStatus: row.membership_status,
    accessExpiresAt: row.access_expires_at,
    lastVerifiedAt: row.last_verified_at,
  };
}
