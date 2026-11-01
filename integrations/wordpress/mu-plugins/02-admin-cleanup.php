<?php
/**
 * Plugin Name: Day Trade Ideas Admin Cleanup
 * Description: Removes promotional notices and non-operational dashboard clutter for administrators.
 */

if (!defined('ABSPATH')) {
    exit;
}

function dtiai_admin_cleanup_enabled(): bool
{
    return is_admin()
        && current_user_can('manage_options')
        && !isset($_GET['dtiai_notices']);
}

add_action('admin_print_styles', static function (): void {
    if (!dtiai_admin_cleanup_enabled()) {
        return;
    }
    ?>
    <style id="dtiai-admin-cleanup">
      #wpbody-content .notice,
      #wpbody-content .update-nag,
      #wpbody-content .fs-notice,
      #wpbody-content .e-notice,
      #wpbody-content .elementor-message,
      #wpbody-content .rsssl-notice,
      #wpbody-content .woocommerce-message,
      #wpbody-content .woocommerce-info,
      #wpbody-content [class*="risk_level_"],
      #wpbody-content [class*="review-notice"],
      #wpbody-content [class*="rating-notice"],
      #dashboard-widgets #wp_toolkit_dashboard_security_risk_widget,
      #dashboard-widgets #wp_toolkit_attacks_widget,
      #dashboard-widgets #wpforms_reports_widget_lite,
      #dashboard-widgets #duplicator_dashboard_widget,
      #dashboard-widgets #e-dashboard-overview,
      #dashboard-widgets #wpseo-dashboard-overview,
      #dashboard-widgets #wpseo-wincher-dashboard-overview,
      #dashboard-widgets #templately_block_patterns,
      #dashboard-widgets #dashboard_primary,
      #dashboard-widgets #dashboard_site_health,
      #wp-admin-bar-updates {
        display: none !important;
      }
    </style>
    <?php
}, 99);

add_action('in_admin_header', static function (): void {
    if (!dtiai_admin_cleanup_enabled()) {
        return;
    }

    remove_all_actions('admin_notices');
    remove_all_actions('all_admin_notices');
    remove_all_actions('network_admin_notices');
    remove_all_actions('user_admin_notices');
}, 999);

add_action('wp_dashboard_setup', static function (): void {
    if (!dtiai_admin_cleanup_enabled()) {
        return;
    }

    $widgets = [
        'wp_toolkit_dashboard_security_risk_widget',
        'wp_toolkit_attacks_widget',
        'wpforms_reports_widget_lite',
        'duplicator_dashboard_widget',
        'e-dashboard-overview',
        'wpseo-dashboard-overview',
        'wpseo-wincher-dashboard-overview',
        'templately_block_patterns',
        'dashboard_primary',
        'dashboard_site_health',
        'dashboard_php_nag',
        'dashboard_browser_nag',
    ];

    foreach ($widgets as $widget) {
        foreach (['normal', 'advanced', 'side', 'column3', 'column4'] as $context) {
            remove_meta_box($widget, 'dashboard', $context);
        }
    }
}, 999);

add_filter('rsssl_notices', static function (array $notices): array {
    if (!dtiai_admin_cleanup_enabled()) {
        return $notices;
    }

    foreach (array_keys($notices) as $key) {
        if (str_starts_with((string) $key, 'risk_level_')) {
            unset($notices[$key]);
        }
    }

    return $notices;
}, 999);
