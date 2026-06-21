<?php
/**
 * Plugin Name: VisionPrime OS
 * Plugin URI: https://visionprime.example
 * Description: سیستم‌عامل چندبرندی مدیریت مشتری، کیف پول، وفاداری، کمپین و هوش تصمیم‌ساز. هر سایت شبکه = یک برند.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Network: true
 * Text Domain: vpos
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VPOS_VERSION', '0.1.0' );
define( 'VPOS_FILE', __FILE__ );
define( 'VPOS_DIR', plugin_dir_path( __FILE__ ) );
define( 'VPOS_URL', plugin_dir_url( __FILE__ ) );
define( 'VPOS_DB_VERSION', '1' );

add_action( 'plugins_loaded', function () {
	load_plugin_textdomain( 'vpos', false, dirname( plugin_basename( VPOS_FILE ) ) . '/languages' );
}, 1 );

require_once VPOS_DIR . 'includes/class-vpos-loader.php';

// Activation hooks can fire before 'plugins_loaded' reaches this plugin, so
// dependencies must already be loaded synchronously here.
$GLOBALS['vpos_loader'] = new VPOS_Loader();
$GLOBALS['vpos_loader']->load_dependencies();

register_activation_hook( __FILE__, array( 'VPOS_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'VPOS_Activator', 'deactivate' ) );
add_action( 'wp_initialize_site', array( 'VPOS_Activator', 'activate_new_site' ) );
add_action( 'plugins_loaded', array( 'VPOS_Activator', 'maybe_upgrade' ) );

add_action( 'plugins_loaded', array( $GLOBALS['vpos_loader'], 'init_modules' ) );
