<?php

namespace DTIAI\Bridge;

if (!defined('ABSPATH')) {
    exit;
}

final class Events
{
    public function __construct()
    {
        add_action('wc_memberships_user_membership_status_changed', [$this, 'membership_changed'], 20, 3);
    }

    public function membership_changed($membership, $old_status, $new_status): void
    {
        $backend_url = Settings::backend_url();
        if ($backend_url === '' || strlen(Settings::secret()) < 32) {
            return;
        }
        $user_id = (int) $membership->get_user_id();
        $active_memberships = function_exists('wc_memberships_get_user_active_memberships')
            ? wc_memberships_get_user_active_memberships($user_id)
            : [];
        $body = wp_json_encode([
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'membership_status_changed',
            'wordpress_user_id' => $user_id,
            'membership_id' => (int) $membership->get_id(),
            'plan_id' => (int) $membership->get_plan_id(),
            'old_status' => (string) $old_status,
            'new_status' => (string) $new_status,
            'active' => !empty($active_memberships),
            'active_memberships' => array_map(static function ($active): array {
                return [
                    'id' => $active->get_id(),
                    'plan_id' => $active->get_plan_id(),
                    'status' => 'wcm-active',
                    'end_date' => $active->get_end_date('timestamp') ?: null,
                ];
            }, $active_memberships),
            'occurred_at' => gmdate('c'),
        ]);
        if (!is_string($body)) {
            return;
        }
        wp_remote_post(
            untrailingslashit($backend_url) . '/v1/integrations/wordpress/membership',
            [
                'timeout' => 5,
                'blocking' => false,
                'headers' => Request_Auth::signed_headers($body),
                'body' => $body,
            ]
        );
    }
}
