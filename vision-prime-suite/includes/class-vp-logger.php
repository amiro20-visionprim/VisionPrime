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

	public function __construct() {
		// Reserved for future hook wiring (e.g. external log shipping).
	}
}
