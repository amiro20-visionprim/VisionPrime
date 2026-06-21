<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Activation/upgrade across the network. Each brand site gets its own
 * tables (branches, customers, wallet, ...); the main site additionally
 * gets the network-level Organization tables (Master Spec §11).
 */
class VPOS_Activator {

	public static function activate( $network_wide ) {
		if ( is_multisite() && $network_wide ) {
			foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site_id ) {
				switch_to_blog( $site_id );
				VPOS_Migrator::run_for_current_site();
				restore_current_blog();
			}
		} else {
			VPOS_Migrator::run_for_current_site();
		}
		update_option( 'vpos_db_version', VPOS_DB_VERSION );
	}

	public static function activate_new_site( $site ) {
		$site_id = is_object( $site ) ? $site->blog_id : $site;
		switch_to_blog( $site_id );
		VPOS_Migrator::run_for_current_site();
		restore_current_blog();
	}

	public static function maybe_upgrade() {
		if ( get_option( 'vpos_db_version' ) === VPOS_DB_VERSION ) {
			return;
		}
		VPOS_Migrator::run_for_current_site();
		update_option( 'vpos_db_version', VPOS_DB_VERSION );
	}

	/**
	 * Defensive self-heal: some deployments (manual file upload, multisite
	 * site created before the plugin was network-activated, etc.) never
	 * fire register_activation_hook for a given site, leaving its tables
	 * missing while the rest of the plugin loads normally and silently
	 * fails every insert/update. Re-running the migrator is idempotent
	 * (dbDelta only creates what's missing), so it's safe to check on
	 * every admin_init, throttled via a transient to avoid the dbDelta
	 * cost on every request.
	 */
	public static function maybe_self_heal() {
		if ( get_transient( 'vpos_self_heal_checked' ) ) {
			return;
		}
		set_transient( 'vpos_self_heal_checked', 1, HOUR_IN_SECONDS );

		global $wpdb;
		$probe = $wpdb->prefix . 'vpos_customers';
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $probe ) );
		if ( $exists !== $probe ) {
			VPOS_Migrator::run_for_current_site();
		}
	}

	public static function deactivate() {
		// Non-destructive: ledgers, customers and audit logs are never
		// touched by deactivation. Only scheduled jobs are cleared.
		if ( VPOS_Jobs::has_action_scheduler() ) {
			as_unschedule_all_actions( null, array(), 'vpos' );
		}
	}
}
