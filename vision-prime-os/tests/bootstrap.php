<?php
/**
 * Standard wp-phpunit bootstrap. Requires the WordPress test suite
 * (wp-env, wp-phpunit, or scripts/install-wp-tests.sh) with WP_TESTS_DIR
 * pointing at it, and WP_TESTS_MULTISITE=1 so Multisite-only behaviour
 * (brand = site provisioning) can be exercised.
 */
$_tests_dir = getenv( 'WP_TESTS_DIR' ) ?: '/tmp/wordpress-tests-lib';

require_once $_tests_dir . '/includes/functions.php';

function _vpos_manually_load_plugin() {
	require dirname( __DIR__ ) . '/vision-prime-os.php';
}
tests_add_filter( 'muplugins_loaded', '_vpos_manually_load_plugin' );

require $_tests_dir . '/includes/bootstrap.php';
