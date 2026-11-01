<?php
/**
 * Plugin Name: Day Trade Ideas AI Bridge
 * Description: Authenticated subscription verification bridge for the Day Trade Ideas AI backend.
 * Version: 0.4.4
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Author: Day Trade Ideas
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DTIAI_BRIDGE_VERSION', '0.4.4');
define('DTIAI_BRIDGE_PATH', plugin_dir_path(__FILE__));
define('DTIAI_BRIDGE_URL', plugin_dir_url(__FILE__));

require_once DTIAI_BRIDGE_PATH . 'includes/class-settings.php';
require_once DTIAI_BRIDGE_PATH . 'includes/class-request-auth.php';
require_once DTIAI_BRIDGE_PATH . 'includes/class-auth-controller.php';
require_once DTIAI_BRIDGE_PATH . 'includes/class-plans-controller.php';
require_once DTIAI_BRIDGE_PATH . 'includes/class-admin-controller.php';
require_once DTIAI_BRIDGE_PATH . 'includes/class-events.php';

add_action('plugins_loaded', static function (): void {
    new \DTIAI\Bridge\Settings();
    new \DTIAI\Bridge\Auth_Controller();
    new \DTIAI\Bridge\Plans_Controller();
    new \DTIAI\Bridge\Admin_Controller();
    new \DTIAI\Bridge\Events();
});
