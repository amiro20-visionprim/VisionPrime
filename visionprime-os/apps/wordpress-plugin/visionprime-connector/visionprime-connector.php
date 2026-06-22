<?php
/**
 * Plugin Name:       VisionPrime Connector
 * Plugin URI:        https://example.com/visionprime-os
 * Description:       Connects this WooCommerce store to VisionPrime OS. Fully AJAX-based connector and customer account display layer (wallet/points/rewards/tier base). No checkout integration yet.
 * Version:           0.2.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            VisionPrime
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       visionprime-connector
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Disallow direct access.
}

define( 'VISIONPRIME_CONNECTOR_VERSION', '0.2.0' );
define( 'VISIONPRIME_CONNECTOR_PATH', plugin_dir_path( __FILE__ ) );
define( 'VISIONPRIME_CONNECTOR_URL', plugin_dir_url( __FILE__ ) );

require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-logger.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-settings.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-auth.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-api-client.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-ajax.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-shortcodes.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-my-account.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-checkout.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-webhooks.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-woocommerce-hooks.php';
require_once VISIONPRIME_CONNECTOR_PATH . 'includes/class-vp-loader.php';

/**
 * Single entry point. Every collaborator is constructed here and handed
 * to VP_Loader, which is the only place that calls add_action/add_filter
 * — keeps wiring auditable in one file instead of scattered across every
 * class's constructor.
 *
 * Secrets (plugin API key, shared secret) live only in PHP option
 * storage via VP_Settings and are read only by VP_Api_Client on the
 * server side — they are never passed to wp_localize_script and never
 * appear in any enqueued JS or page markup.
 */
function visionprime_connector_init() {
	$settings   = new VP_Settings();
	$logger     = new VP_Logger( $settings );
	$auth       = new VP_Auth();
	$api_client = new VP_Api_Client( $settings, $auth, $logger );
	$webhooks   = new VP_Webhooks( $settings, $api_client, $logger );
	$ajax       = new VP_Ajax( $settings, $auth, $api_client, $logger, $webhooks );
	$shortcodes = new VP_Shortcodes( $settings, $auth );
	$my_account = new VP_My_Account( $settings, $auth );
	$checkout   = new VP_Checkout( $settings );
	$wc_hooks   = new VP_WooCommerce_Hooks( $settings, $logger );

	$loader = new VP_Loader( $settings, $auth, $ajax, $shortcodes, $my_account, $checkout, $webhooks, $wc_hooks );
	$loader->run();
}
add_action( 'plugins_loaded', 'visionprime_connector_init' );
