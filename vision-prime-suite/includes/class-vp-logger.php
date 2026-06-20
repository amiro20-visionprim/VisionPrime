<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Unified logging used by every module (vp_logs table). Centralizing this
 * means each module's "log & report" feature is automatically professional
 * and consistent instead of reinvented per module.
 */
class VP_Logger {

	const LEVELS = array( 'debug', 'info', 'notice', 'warning', 'error', 'critical' );

	public static function log( $module, $message, $level = 'info', $context = array() ) {
		global $wpdb;

		if ( ! in_array( $level, self::LEVELS, true ) ) {
			$level = 'info';
		}

		$wpdb->insert(
			$wpdb->prefix . 'vp_logs',
			array(
				'module'     => sanitize_key( $module ),
				'level'      => $level,
				'message'    => wp_strip_all_tags( $message ),
				'context'    => wp_json_encode( $context ),
				'user_id'    => get_current_user_id() ?: null,
				'created_at' => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%s', '%s', '%d', '%s' )
		);

		do_action( 'vp_suite_logged', $module, $level, $message, $context );
	}

	public static function query( $args = array() ) {
		global $wpdb;
		$table   = $wpdb->prefix . 'vp_logs';
		$where   = array( '1=1' );
		$params  = array();

		if ( ! empty( $args['module'] ) ) {
			$where[]  = 'module = %s';
			$params[] = $args['module'];
		}
		if ( ! empty( $args['level'] ) ) {
			$where[]  = 'level = %s';
			$params[] = $args['level'];
		}

		$limit  = isset( $args['limit'] ) ? absint( $args['limit'] ) : 50;
		$offset = isset( $args['offset'] ) ? absint( $args['offset'] ) : 0;

		$sql = "SELECT * FROM $table WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d OFFSET %d';
		$params[] = $limit;
		$params[] = $offset;

		return $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
	}

	/**
	 * Deletes log rows older than the configured retention window. Called
	 * from the daily cron tick so the logs table never grows unbounded on
	 * busy commercial sites.
	 *
	 * @return int Rows deleted.
	 */
	public static function prune() {
		global $wpdb;
		$days = (int) VP_Settings::get( 'log_retention_days', 90 );
		if ( $days < 1 ) {
			return 0;
		}
		$cutoff = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp', true ) - $days * DAY_IN_SECONDS );

		return (int) $wpdb->query(
			$wpdb->prepare( "DELETE FROM {$wpdb->prefix}vp_logs WHERE created_at < %s", $cutoff )
		);
	}

	public function __construct() {
		// Reserved for future hook wiring (e.g. external log shipping).
	}
}
