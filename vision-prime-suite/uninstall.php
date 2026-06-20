<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Data (jobs, logs, competitor reports, social accounts/posts, API keys)
 * is intentionally left in place on uninstall — holdings rely on the
 * report/log history for audits. Only plugin options are cleared.
 */
delete_option( 'vp_suite_settings' );
delete_option( 'vp_suite_db_version' );
