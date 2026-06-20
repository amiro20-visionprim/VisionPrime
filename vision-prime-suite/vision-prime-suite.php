<?php
/**
 * Plugin Name: VisionPrime Suite
 * Plugin URI: https://visionprime.example
 * Description: اکوسیستم یکپارچه‌ی تولید محتوا، سئو، تحلیل رقبا و توزیع چندکاناله برای هلدینگ ویژن پرایم. پشتیبانی از ۱۵+ مدل هوش مصنوعی (از طریق OpenRouter و سرویس‌های مستقیم)، سینک کامل با Rank Math، صف انتشار پیشرفته و ماژول‌های شبکه‌های اجتماعی.
 * Version: 0.5.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Network: true
 * Text Domain: vp-suite
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'VP_SUITE_VERSION', '0.7.0' );
define( 'VP_SUITE_FILE', __FILE__ );
define( 'VP_SUITE_DIR', plugin_dir_path( __FILE__ ) );
define( 'VP_SUITE_URL', plugin_dir_url( __FILE__ ) );
define( 'VP_SUITE_DB_VERSION', '3' );

require_once VP_SUITE_DIR . 'includes/class-vp-loader.php';

register_activation_hook( __FILE__, array( 'VP_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'VP_Activator', 'deactivate' ) );
add_action( 'plugins_loaded', array( 'VP_Activator', 'maybe_upgrade' ) );

/**
 * Boots the plugin. Each site in a multisite network gets its own
 * settings/content/logs (per-site tables), while network admins can
 * optionally push a shared API key set to all sites from Network Settings.
 */
function vp_suite_run() {
	$loader = new VP_Loader();
	$loader->run();
}
add_action( 'plugins_loaded', 'vp_suite_run' );
