<?php

namespace DTIAI\Bridge;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if (!defined('ABSPATH')) {
    exit;
}

final class Admin_Controller
{
    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_page']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('in_admin_header', [$this, 'suppress_notices']);
    }

    public function add_page(): void
    {
        add_menu_page(
            'Jason AI Management',
            'Jason AI',
            'manage_options',
            'dtiai-admin',
            [$this, 'render_page'],
            'dashicons-chart-line',
            3
        );
    }

    public function enqueue_assets(string $hook): void
    {
        if ($hook !== 'toplevel_page_dtiai-admin') {
            return;
        }
        $base = DTIAI_BRIDGE_URL . 'assets/';
        wp_enqueue_style('dtiai-admin', $base . 'admin.css', [], DTIAI_BRIDGE_VERSION);
        wp_enqueue_style('dtiai-admin-tables', $base . 'admin-tables.css', ['dtiai-admin'], DTIAI_BRIDGE_VERSION);
        wp_enqueue_style('dtiai-admin-knowledge', $base . 'admin-knowledge-v2.css', ['dtiai-admin'], DTIAI_BRIDGE_VERSION);
        wp_enqueue_script('dtiai-admin-core', $base . 'admin-core.js', ['wp-api-fetch'], DTIAI_BRIDGE_VERSION, true);
        wp_enqueue_script(
            'dtiai-admin-knowledge-view',
            $base . 'admin-knowledge-view.js',
            ['dtiai-admin-core'],
            DTIAI_BRIDGE_VERSION,
            true
        );
        foreach (['dashboard', 'subscribers', 'settings', 'knowledge', 'feedback', 'activity'] as $module) {
            $dependencies = $module === 'knowledge'
                ? ['dtiai-admin-knowledge-view']
                : ['dtiai-admin-core'];
            wp_enqueue_script(
                'dtiai-admin-' . $module,
                $base . 'admin-' . $module . '.js',
                $dependencies,
                DTIAI_BRIDGE_VERSION,
                true
            );
        }
        wp_localize_script('dtiai-admin-core', 'DTIAIAdminConfig', [
            'root' => esc_url_raw(rest_url('dtiai/v1/admin-proxy/')),
            'nonce' => wp_create_nonce('wp_rest'),
            'settingsUrl' => esc_url_raw(admin_url('options-general.php?page=dtiai-bridge')),
        ]);
    }

    public function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        require DTIAI_BRIDGE_PATH . 'templates/admin-page.php';
    }

    public function suppress_notices(): void
    {
        $screen = get_current_screen();
        if (!$screen || $screen->id !== 'toplevel_page_dtiai-admin') {
            return;
        }
        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');
        remove_all_actions('network_admin_notices');
        remove_all_actions('user_admin_notices');
    }

    public function register_routes(): void
    {
        register_rest_route('dtiai/v1', '/admin-proxy/(?P<backend_path>.+)', [
            'methods' => WP_REST_Server::ALLMETHODS,
            'permission_callback' => static fn(): bool => current_user_can('manage_options'),
            'callback' => [$this, 'proxy'],
        ]);
    }

    public function proxy(WP_REST_Request $request)
    {
        $method = strtoupper($request->get_method());
        $path = '/' . ltrim((string) $request->get_param('backend_path'), '/');
        if (!$this->allowed($method, $path)) {
            return new WP_REST_Response(['message' => 'Unsupported admin operation.'], 403);
        }
        $backend = untrailingslashit(Settings::backend_url());
        $token = Settings::admin_token();
        if ($backend === '') {
            return new WP_REST_Response([
                'message' => 'Backend URL is not configured in Day Trade Ideas AI settings.',
            ], 503);
        }
        if (strlen($token) < 32) {
            return new WP_REST_Response([
                'message' => 'Admin API token is not configured in Day Trade Ideas AI settings.',
            ], 503);
        }

        $query = array_intersect_key(
            $request->get_query_params(),
            array_flip(['search', 'status', 'limit', 'offset', 'days'])
        );
        $url = $backend . $path;
        if (!empty($query)) {
            $url = add_query_arg($query, $url);
        }
        $body = $request->get_json_params();
        $args = [
            'method' => $method,
            'timeout' => 30,
            'redirection' => 3,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'X-Admin-Token' => $token,
            ],
        ];
        if (is_array($body) && !empty($body)) {
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return new WP_REST_Response(['message' => 'Backend request failed.'], 502);
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $data = json_decode((string) wp_remote_retrieve_body($response), true);
        return new WP_REST_Response(
            is_array($data) ? $data : ['message' => 'Invalid backend response.'],
            $code > 0 ? $code : 502
        );
    }

    private function allowed(string $method, string $path): bool
    {
        $get = [
            '/v1/admin/overview',
            '/v1/admin/xai-balance',
            '/v1/admin/knowledge/documents',
            '/v1/admin/analysis',
            '/v1/admin/integration-status',
            '/v1/admin/subscribers',
            '/v1/admin/settings',
            '/v1/admin/answers',
            '/v1/admin/usage',
            '/v1/admin/subscription-events',
            '/v1/admin/knowledge',
            '/v1/admin/feedback',
            '/v1/admin/audit',
        ];
        if ($method === 'GET' && in_array($path, $get, true)) {
            return true;
        }
        if ($method === 'PATCH' && $path === '/v1/admin/settings') {
            return true;
        }
        if ($method === 'POST' && in_array($path, [
            '/v1/admin/subscriptions/reconcile',
            '/v1/admin/retention/run',
            '/v1/admin/knowledge/documents',
        ], true)) {
            return true;
        }
        $id = '[0-9a-f-]{36}';
        return (bool) preg_match(
            '#^/v1/admin/(subscribers/' . $id . '/(status|unlink)|knowledge/(?:documents/)?' . $id . '(?:/approval)?|feedback/' . $id . ')$#',
            $path
        );
    }
}
