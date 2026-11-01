<?php

namespace DTIAI\Bridge;

use WP_REST_Request;

if (!defined('ABSPATH')) {
    exit;
}

final class Auth_Controller
{
    private const OTP_TTL = 600;
    private const MAX_ATTEMPTS = 5;

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_filter('wp_mail_logging_before_log_email', [$this, 'redact_verification_email']);
    }

    public function register_routes(): void
    {
        register_rest_route('dtiai/v1', '/health', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => fn() => [
                'ok' => true,
                'memberships_active' => function_exists('wc_memberships_get_user_active_memberships'),
            ],
        ]);
        register_rest_route('dtiai/v1', '/request-code', [
            'methods' => 'POST',
            'permission_callback' => [Request_Auth::class, 'verify'],
            'callback' => [$this, 'request_code'],
        ]);
        register_rest_route('dtiai/v1', '/verify-code', [
            'methods' => 'POST',
            'permission_callback' => [Request_Auth::class, 'verify'],
            'callback' => [$this, 'verify_code'],
        ]);
        register_rest_route('dtiai/v1', '/membership-status', [
            'methods' => 'POST',
            'permission_callback' => [Request_Auth::class, 'verify'],
            'callback' => [$this, 'membership_status'],
        ]);
    }

    public function request_code(WP_REST_Request $request)
    {
        $email = $this->normalize_email((string) ($request->get_json_params()['email'] ?? ''));
        $this->send_generic_result();

        if (!is_email($email) || !$this->allow_request($email)) {
            return new \WP_REST_Response(['accepted' => true], 202);
        }
        $user = get_user_by('email', $email);
        if (!$user) {
            return new \WP_REST_Response(['accepted' => true], 202);
        }

        $code = (string) wp_rand(100000, 999999);
        $record = [
            'hash' => wp_hash_password($code),
            'attempts' => 0,
            'expires_at' => time() + self::OTP_TTL,
        ];
        set_transient($this->otp_key($email), $record, self::OTP_TTL);
        wp_mail(
            $email,
            'Your Day Trade Ideas AI verification code',
            "Your verification code is: {$code}\n\nIt expires in 10 minutes. " .
            "If you did not request this, you can ignore this email."
        );
        return new \WP_REST_Response(['accepted' => true], 202);
    }

    public function verify_code(WP_REST_Request $request)
    {
        $params = $request->get_json_params();
        $email = $this->normalize_email((string) ($params['email'] ?? ''));
        $code = preg_replace('/\D/', '', (string) ($params['code'] ?? ''));
        $record = get_transient($this->otp_key($email));
        if (!is_array($record) || strlen($code) !== 6) {
            return new \WP_REST_Response(['valid' => false], 401);
        }
        if (($record['attempts'] ?? 0) >= self::MAX_ATTEMPTS || time() >= ($record['expires_at'] ?? 0)) {
            delete_transient($this->otp_key($email));
            return new \WP_REST_Response(['valid' => false], 401);
        }
        if (!wp_check_password($code, (string) $record['hash'])) {
            $record['attempts'] = (int) $record['attempts'] + 1;
            set_transient($this->otp_key($email), $record, self::OTP_TTL);
            return new \WP_REST_Response(['valid' => false], 401);
        }
        delete_transient($this->otp_key($email));
        $user = get_user_by('email', $email);
        $memberships = $user ? $this->active_memberships((int) $user->ID) : [];
        return [
            'valid' => true,
            'eligible' => !empty($memberships),
            'wordpress_user_id' => $user ? (int) $user->ID : null,
            'email' => $email,
            'memberships' => $memberships,
        ];
    }

    public function membership_status(WP_REST_Request $request)
    {
        $user_id = absint($request->get_json_params()['wordpress_user_id'] ?? 0);
        if ($user_id < 1 || !get_userdata($user_id)) {
            return new \WP_REST_Response(['valid' => false], 404);
        }
        $memberships = $this->active_memberships($user_id);
        return [
            'valid' => true,
            'eligible' => !empty($memberships),
            'wordpress_user_id' => $user_id,
            'memberships' => $memberships,
        ];
    }

    private function active_memberships(int $user_id): array
    {
        if (!function_exists('wc_memberships_get_user_active_memberships')) {
            return [];
        }
        return array_map(static function ($membership): array {
            return [
                'id' => $membership->get_id(),
                'plan_id' => $membership->get_plan_id(),
                'status' => 'wcm-active',
                'end_date' => $membership->get_end_date('timestamp') ?: null,
            ];
        }, wc_memberships_get_user_active_memberships($user_id));
    }

    private function allow_request(string $email): bool
    {
        $key = 'dtiai_rate_' . hash('sha256', $email);
        $count = (int) get_transient($key);
        if ($count >= 3) {
            return false;
        }
        set_transient($key, $count + 1, 600);
        return true;
    }

    private function normalize_email(string $email): string
    {
        return strtolower(trim(sanitize_email($email)));
    }

    private function otp_key(string $email): string
    {
        return 'dtiai_otp_' . hash('sha256', $email);
    }

    private function send_generic_result(): void
    {
        if (!headers_sent()) {
            nocache_headers();
        }
    }

    public function redact_verification_email(array $mail_data): array
    {
        $subject = (string) ($mail_data['subject'] ?? '');
        if (str_starts_with($subject, 'Your Day Trade Ideas AI verification code')) {
            $mail_data['message'] = '[Verification code redacted from mail logs]';
        }
        return $mail_data;
    }
}
