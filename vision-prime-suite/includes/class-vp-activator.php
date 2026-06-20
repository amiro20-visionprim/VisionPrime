<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles activation/deactivation, including per-site table creation
 * across a multisite network so each holding site has its own data.
 */
class VP_Activator {

	public static function activate( $network_wide ) {
		if ( is_multisite() && $network_wide ) {
			$site_ids = get_sites( array( 'fields' => 'ids' ) );
			foreach ( $site_ids as $site_id ) {
				switch_to_blog( $site_id );
				self::create_tables();
				self::seed_defaults();
				restore_current_blog();
			}
		} else {
			self::create_tables();
			self::seed_defaults();
		}
	}

	public static function activate_new_site( $blog_id ) {
		switch_to_blog( $blog_id );
		self::create_tables();
		self::seed_defaults();
		restore_current_blog();
	}

	/**
	 * Runs on every page load (cheap option check) so existing installs
	 * pick up new tables/columns added in later versions without requiring
	 * a manual deactivate/reactivate.
	 */
	public static function maybe_upgrade() {
		if ( get_option( 'vp_suite_db_version' ) === VP_SUITE_DB_VERSION ) {
			return;
		}

		if ( is_multisite() ) {
			$site_ids = get_sites( array( 'fields' => 'ids' ) );
			foreach ( $site_ids as $site_id ) {
				switch_to_blog( $site_id );
				self::create_tables();
				restore_current_blog();
			}
		} else {
			self::create_tables();
		}
	}

	public static function deactivate() {
		// Intentionally non-destructive: data, queues and logs are kept.
		// Recurring schedules are cleared so no orphan cron events remain.
		if ( class_exists( 'VP_Cron' ) ) {
			VP_Cron::clear_schedules();
		} else {
			foreach ( array( 'vp_cron_run_queue', 'vp_cron_refresh_social_stats', 'vp_cron_operator_digest' ) as $event ) {
				$timestamp = wp_next_scheduled( $event );
				if ( $timestamp ) {
					wp_unschedule_event( $timestamp, $event );
				}
			}
		}
	}

	public static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$prefix           = $wpdb->prefix;

		$sql = array();

		$sql[] = "CREATE TABLE {$prefix}vp_api_keys (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			label VARCHAR(191) NOT NULL,
			provider VARCHAR(60) NOT NULL,
			scope VARCHAR(60) NOT NULL DEFAULT 'shared',
			api_key TEXT NOT NULL,
			meta LONGTEXT NULL,
			priority SMALLINT NOT NULL DEFAULT 100,
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY provider (provider),
			KEY scope (scope),
			KEY priority (priority)
		) $charset_collate;";

		$sql[] = "CREATE TABLE {$prefix}vp_jobs (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			job_type VARCHAR(40) NOT NULL,
			title VARCHAR(255) NOT NULL DEFAULT '',
			status VARCHAR(30) NOT NULL DEFAULT 'draft',
			provider VARCHAR(60) NULL,
			model VARCHAR(120) NULL,
			prompt_snapshot LONGTEXT NULL,
			content_snapshot LONGTEXT NULL,
			target_post_id BIGINT UNSIGNED NULL,
			scheduled_at DATETIME NULL,
			created_by BIGINT UNSIGNED NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY job_type (job_type),
			KEY status (status),
			KEY scheduled_at (scheduled_at)
		) $charset_collate;";

		$sql[] = "CREATE TABLE {$prefix}vp_logs (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			module VARCHAR(60) NOT NULL,
			level VARCHAR(20) NOT NULL DEFAULT 'info',
			message TEXT NOT NULL,
			context LONGTEXT NULL,
			user_id BIGINT UNSIGNED NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY module (module),
			KEY level (level),
			KEY created_at (created_at)
		) $charset_collate;";

		$sql[] = "CREATE TABLE {$prefix}vp_competitor_reports (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			keyword VARCHAR(255) NOT NULL,
			target_url VARCHAR(500) NULL,
			provider VARCHAR(60) NULL,
			findings LONGTEXT NULL,
			opportunity_score SMALLINT NULL,
			status VARCHAR(30) NOT NULL DEFAULT 'new',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY keyword (keyword(191)),
			KEY status (status)
		) $charset_collate;";

		$sql[] = "CREATE TABLE {$prefix}vp_social_accounts (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			channel VARCHAR(40) NOT NULL,
			label VARCHAR(191) NOT NULL,
			config LONGTEXT NULL,
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY channel (channel)
		) $charset_collate;";

		$sql[] = "CREATE TABLE {$prefix}vp_social_posts (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			account_id BIGINT UNSIGNED NOT NULL,
			job_id BIGINT UNSIGNED NULL,
			status VARCHAR(30) NOT NULL DEFAULT 'queued',
			payload LONGTEXT NULL,
			response LONGTEXT NULL,
			stats LONGTEXT NULL,
			sent_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY account_id (account_id),
			KEY status (status)
		) $charset_collate;";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}

		update_option( 'vp_suite_db_version', VP_SUITE_DB_VERSION );
	}

	private static function seed_defaults() {
		if ( get_option( 'vp_suite_settings' ) === false ) {
			update_option(
				'vp_suite_settings',
				array(
					'shared_api_mode'      => true,
					'default_provider'     => 'openrouter',
					'article_prompt'       => VP_Content_Generator::default_prompt( 'article' ),
					'product_prompt'       => VP_Content_Generator::default_prompt( 'product' ),
					'seo_prompt'           => VP_SEO_Engine::default_prompt(),
					'competitor_prompt'    => VP_Competitor_Analysis::default_prompt(),
					'rankmath_sync'        => true,
					'image_generation'     => true,
				)
			);
		}
	}
}
