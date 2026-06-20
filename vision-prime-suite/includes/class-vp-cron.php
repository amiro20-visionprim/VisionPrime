<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Central scheduler. Registers the recurring WP-Cron events that drive the
 * "advanced publishing queue" (timed releases), periodic social stats
 * refresh, and the operator digest. Keeping every recurring task here means
 * activation/teardown of schedules lives in one predictable place.
 */
class VP_Cron {

	const EVENT_QUEUE   = 'vp_cron_run_queue';
	const EVENT_SOCIAL  = 'vp_cron_refresh_social_stats';
	const EVENT_DIGEST  = 'vp_cron_operator_digest';

	public function __construct() {
		add_filter( 'cron_schedules', array( __CLASS__, 'add_intervals' ) );
		add_action( 'init', array( $this, 'ensure_schedules' ) );
		add_action( self::EVENT_QUEUE, array( $this, 'run_queue' ) );
		add_action( self::EVENT_SOCIAL, array( $this, 'refresh_social_stats' ) );
		add_action( self::EVENT_DIGEST, array( $this, 'send_digest' ) );
	}

	/**
	 * Idempotently registers the recurring events. Runs on every load so a
	 * site that activated network-wide still gets its schedules even if the
	 * activation hook didn't fire on this particular blog.
	 */
	public function ensure_schedules() {
		if ( ! wp_next_scheduled( self::EVENT_QUEUE ) ) {
			wp_schedule_event( time() + 60, 'vp_five_minutes', self::EVENT_QUEUE );
		}
		if ( ! wp_next_scheduled( self::EVENT_SOCIAL ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::EVENT_SOCIAL );
		}
		if ( ! wp_next_scheduled( self::EVENT_DIGEST ) ) {
			wp_schedule_event( $this->next_digest_time(), 'daily', self::EVENT_DIGEST );
		}
	}

	public static function clear_schedules() {
		foreach ( array( self::EVENT_QUEUE, self::EVENT_SOCIAL, self::EVENT_DIGEST ) as $event ) {
			$timestamp = wp_next_scheduled( $event );
			if ( $timestamp ) {
				wp_unschedule_event( $timestamp, $event );
			}
		}
	}

	/**
	 * Adds the custom 5-minute interval used by the publishing queue.
	 * Hooked via 'cron_schedules' from the plugin bootstrap.
	 */
	public static function add_intervals( $schedules ) {
		$schedules['vp_five_minutes'] = array(
			'interval' => 5 * MINUTE_IN_SECONDS,
			'display'  => __( 'هر ۵ دقیقه (VisionPrime)', 'vp-suite' ),
		);
		return $schedules;
	}

	public function run_queue() {
		VP_Queue::run_due_scheduled();
	}

	public function refresh_social_stats() {
		if ( ! class_exists( 'VP_Social_Manager' ) ) {
			return;
		}

		global $wpdb;
		$accounts = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}vp_social_accounts WHERE is_active = 1" );

		foreach ( $accounts as $account ) {
			$channel = VP_Social_Manager::get_channel( $account->channel );
			if ( ! $channel ) {
				continue;
			}
			$stats = $channel->get_stats( $account );
			if ( is_wp_error( $stats ) || empty( $stats ) ) {
				continue;
			}
			$wpdb->update(
				$wpdb->prefix . 'vp_social_accounts',
				array( 'updated_at' => current_time( 'mysql' ) ),
				array( 'id' => $account->id ),
				array( '%s' ),
				array( '%d' )
			);
			update_option( 'vp_social_stats_' . $account->id, $stats, false );
		}

		VP_Logger::log( 'cron', 'آمار شبکه‌های اجتماعی به‌روزرسانی شد.', 'debug' );
	}

	public function send_digest() {
		if ( class_exists( 'VP_Logger' ) ) {
			VP_Logger::prune();
		}
		if ( class_exists( 'VP_Reports' ) ) {
			VP_Reports::dispatch_digest();
		}
	}

	private function next_digest_time() {
		// Default: tomorrow at 08:00 site-local.
		$tomorrow = strtotime( 'tomorrow 08:00', current_time( 'timestamp' ) );
		return $tomorrow - ( (int) ( get_option( 'gmt_offset' ) * HOUR_IN_SECONDS ) );
	}
}
