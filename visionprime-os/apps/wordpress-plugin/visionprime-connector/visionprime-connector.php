<?php
/**
 * Plugin Name:       VisionPrime Connector
 * Plugin URI:        https://example.com/visionprime-os
 * Description:       Connects this WooCommerce store to VisionPrime OS. Phase 01 placeholder — no AJAX business actions, wallet, rewards, or checkout logic yet.
 * Version:           0.1.0
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

define( 'VISIONPRIME_CONNECTOR_VERSION', '0.1.0' );
define( 'VISIONPRIME_CONNECTOR_PATH', plugin_dir_path( __FILE__ ) );
define( 'VISIONPRIME_CONNECTOR_URL', plugin_dir_url( __FILE__ ) );

/**
 * Phase 01: bootstrap only.
 *
 * No AJAX handlers, no WooCommerce sync, no wallet/reward/checkout
 * logic are registered yet — see /docs/phase-01-foundation.md.
 *
 * The plugin's API secret (once introduced) will live only in PHP
 * options storage (e.g. via the Settings API), never echoed into
 * enqueued JavaScript or page markup.
 */
function visionprime_connector_init() {
	// Intentionally empty for Phase 01.
}
add_action( 'plugins_loaded', 'visionprime_connector_init' );
