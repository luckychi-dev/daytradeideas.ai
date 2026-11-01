<?php

namespace DTIAI\Bridge;

if (!defined('ABSPATH')) {
    exit;
}

final class Settings
{
    public const OPTION_BACKEND_URL = 'dtiai_backend_url';
    public const OPTION_BRIDGE_SECRET = 'dtiai_bridge_secret';
    public const OPTION_ADMIN_TOKEN = 'dtiai_admin_api_token';

    public function __construct()
    {
        add_action('admin_menu', [$this, 'add_page']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    public function add_page(): void
    {
        add_options_page(
            'Day Trade Ideas AI Bridge',
            'Day Trade Ideas AI',
            'manage_options',
            'dtiai-bridge',
            [$this, 'render_page']
        );
    }

    public function register_settings(): void
    {
        register_setting('dtiai_bridge', self::OPTION_BACKEND_URL, [
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => '',
        ]);
        register_setting('dtiai_bridge', self::OPTION_BRIDGE_SECRET, [
            'type' => 'string',
            'sanitize_callback' => [$this, 'sanitize_secret'],
            'default' => '',
        ]);
        register_setting('dtiai_bridge', self::OPTION_ADMIN_TOKEN, [
            'type' => 'string',
            'sanitize_callback' => [$this, 'sanitize_admin_token'],
            'default' => '',
        ]);
    }

    public function sanitize_secret($value): string
    {
        $value = sanitize_text_field((string) $value);
        if ($value === '') {
            return (string) get_option(self::OPTION_BRIDGE_SECRET, '');
        }
        return strlen($value) >= 32 ? $value : '';
    }

    public function sanitize_admin_token($value): string
    {
        $value = sanitize_text_field((string) $value);
        if ($value === '') {
            return (string) get_option(self::OPTION_ADMIN_TOKEN, '');
        }
        return strlen($value) >= 32 ? $value : '';
    }

    public function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1>Day Trade Ideas AI Bridge</h1>
            <p>Configure the private backend endpoint and shared HMAC secret.</p>
            <form action="options.php" method="post">
                <?php settings_fields('dtiai_bridge'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="dtiai_backend_url">Backend URL</label></th>
                        <td>
                            <input id="dtiai_backend_url" class="regular-text" type="url"
                                name="<?php echo esc_attr(self::OPTION_BACKEND_URL); ?>"
                                value="<?php echo esc_attr((string) get_option(self::OPTION_BACKEND_URL, '')); ?>"
                                placeholder="https://ai-api.example.com">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="dtiai_bridge_secret">Shared secret</label></th>
                        <td>
                            <input id="dtiai_bridge_secret" class="regular-text" type="password"
                                name="<?php echo esc_attr(self::OPTION_BRIDGE_SECRET); ?>"
                                value="" autocomplete="new-password">
                            <p class="description">At least 32 characters. Leave blank to keep the current secret.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="dtiai_admin_token">Admin API token</label></th>
                        <td>
                            <input id="dtiai_admin_token" class="regular-text" type="password"
                                name="<?php echo esc_attr(self::OPTION_ADMIN_TOKEN); ?>"
                                value="" autocomplete="new-password">
                            <p class="description">Backend ADMIN_API_TOKEN. Leave blank to keep it.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public static function backend_url(): string
    {
        if (defined('DTIAI_BACKEND_URL')) {
            return esc_url_raw((string) constant('DTIAI_BACKEND_URL'));
        }
        return esc_url_raw((string) get_option(self::OPTION_BACKEND_URL, ''));
    }

    public static function secret(): string
    {
        if (defined('DTIAI_BRIDGE_SECRET')) {
            return (string) constant('DTIAI_BRIDGE_SECRET');
        }
        return (string) get_option(self::OPTION_BRIDGE_SECRET, '');
    }

    public static function admin_token(): string
    {
        if (defined('DTIAI_ADMIN_API_TOKEN')) {
            return (string) constant('DTIAI_ADMIN_API_TOKEN');
        }
        return (string) get_option(self::OPTION_ADMIN_TOKEN, '');
    }
}
